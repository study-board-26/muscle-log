import { useCallback, useEffect, useState } from "react";
import { REGIONS, type Master } from "../data/master";
import { getAllSets, getSetting, setSetting, type SetLogRec } from "../db";
import { bestE1rm, e1rmSeries, formatKg, type E1rmPoint } from "../lib/e1rm";
import { DELOAD_GUIDE, evaluateDeload, type DeloadVerdict } from "../lib/deload";
import type { Experience } from "../lib/progression";
import {
  STATUS_LABEL,
  WEEKLY_RANGE,
  aggregateVolume,
  weekLabel,
  weekStart,
  weeksWithData,
  type GroupVolume,
} from "../lib/volume";

const DAY = 86400000;

/** e1RM の推移。値の増減が読み取れれば十分なので、軸ラベルは最小限にする。 */
function Spark({ points }: { points: E1rmPoint[] }) {
  const w = 260;
  const h = 56;
  const pad = 6;

  if (points.length < 2) return <div className="spark-empty">2セッション以上で推移を表示</div>;

  const xs = points.map((p) => p.at);
  const ys = points.map((p) => p.value);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const spanX = x1 - x0 || 1;
  const spanY = y1 - y0 || 1;

  const px = (v: number) => pad + ((v - x0) / spanX) * (w - pad * 2);
  const py = (v: number) => h - pad - ((v - y0) / spanY) * (h - pad * 2);

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${px(p.at).toFixed(1)},${py(p.value).toFixed(1)}`)
    .join(" ");
  const area = `${d} L${px(x1).toFixed(1)},${h - pad} L${px(x0).toFixed(1)},${h - pad} Z`;
  const last = points[points.length - 1];

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="e1RMの推移">
      <path d={area} fill="var(--accent-soft)" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
      {points.filter((p) => p.isBest).map((p) => (
        <circle key={p.sessionId} cx={px(p.at)} cy={py(p.value)} r="2.6" fill="var(--green)" />
      ))}
      <circle cx={px(last.at)} cy={py(last.value)} r="3.4" fill="var(--accent)" />
    </svg>
  );
}

function VolumeBar({ v }: { v: GroupVolume }) {
  const [lo, hi] = v.range;
  // 目盛りは上限の1.5倍まで。過多がどれだけ超えているかも見えるようにする。
  const scaleMax = hi * 1.5;
  const pct = (n: number) => `${Math.min(100, (n / scaleMax) * 100)}%`;

  return (
    <div className={`vol-row st-${v.status}`}>
      <span className="vol-name">{v.group}</span>
      <div className="vol-track" aria-hidden="true">
        <span className="vol-range" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />
        <span className="vol-fill" style={{ width: pct(v.sets) }} />
      </div>
      <span className="vol-num">{v.sets}</span>
      <span className="vol-status">{STATUS_LABEL[v.status]}</span>
    </div>
  );
}

export function Analysis({ master }: { master: Master }) {
  const [sets, setSets] = useState<SetLogRec[] | null>(null);
  const [experience, setExperience] = useState<Experience>("beginner");
  const [weekIdx, setWeekIdx] = useState(0);
  const [verdict, setVerdict] = useState<DeloadVerdict | null>(null);
  const [deloadUntil, setDeloadUntil] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [all, exp, until, last] = await Promise.all([
      getAllSets(),
      getSetting<Experience>("experience"),
      getSetting<number>("deloadUntil"),
      getSetting<number>("lastDeloadAt"),
    ]);
    setSets(all);
    setExperience(exp ?? "beginner");
    setDeloadUntil(until ?? null);

    const byEx = new Map<string, SetLogRec[]>();
    for (const s of all) {
      const list = byEx.get(s.exerciseId) ?? [];
      list.push(s);
      byEx.set(s.exerciseId, list);
    }
    setVerdict(evaluateDeload(byEx, master.exercises, Date.now(), last ?? null));
  }, [master]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!sets) {
    return (
      <main className="state">
        <p>読み込み中…</p>
      </main>
    );
  }

  if (sets.length === 0) {
    return (
      <main className="state">
        <p>まだ記録がありません。</p>
        <p className="hint">
          記録タブでセットを保存すると、部位別のボリュームと推定1RMの推移が出ます。
        </p>
      </main>
    );
  }

  const range = WEEKLY_RANGE[experience];
  const weeks = weeksWithData(sets);
  const currentWeek = weeks[Math.min(weekIdx, weeks.length - 1)] ?? weekStart(Date.now());
  const weekSets = sets.filter(
    (s) => s.loggedAt >= currentWeek && s.loggedAt < currentWeek + 7 * DAY
  );
  const volumes = aggregateVolume(weekSets, master.exercises, master.muscles, range);

  const deloadActive = deloadUntil !== null && Date.now() < deloadUntil;

  const e1rmRows = master.exercises
    .map((ex) => {
      const mine = sets.filter((s) => s.exerciseId === ex.id);
      if (mine.length === 0) return null;
      return {
        id: ex.id,
        code: ex.code,
        name: ex.name,
        points: e1rmSeries(mine),
        best: bestE1rm(mine),
        sessions: new Set(mine.map((s) => s.sessionId)).size,
        lastAt: Math.max(...mine.map((s) => s.loggedAt)),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.lastAt - a.lastAt);

  return (
    <main className="progress">
      {/* デロード（ALG-4） */}
      {deloadActive ? (
        <section className="deload active">
          <p className="deload-title">デロード週です</p>
          <p>{DELOAD_GUIDE.text}</p>
          <p className="hint">
            {new Date(deloadUntil).getMonth() + 1}/{new Date(deloadUntil).getDate()} まで
          </p>
        </section>
      ) : verdict?.suggest ? (
        <section className="deload">
          <p className="deload-title">デロードを検討してください</p>
          <p>{verdict.reason}</p>
          <ul>
            {verdict.flagged.map((f) => (
              <li key={f.exerciseId}>
                {f.name}：自己ベスト停滞、RIR {f.rirDrop?.toFixed(1)} 低下
              </li>
            ))}
          </ul>
          <p className="hint">{DELOAD_GUIDE.text}</p>
          <button
            type="button"
            className="sub-btn"
            onClick={async () => {
              const now = Date.now();
              await setSetting("lastDeloadAt", now);
              await setSetting("deloadUntil", now + DELOAD_GUIDE.days * DAY);
              await load();
            }}
          >
            デロードを開始する
          </button>
        </section>
      ) : null}

      {/* 週間ボリューム（ALG-2 / ALG-6） */}
      <section className="vol">
        <header className="vol-head">
          <h2>週間ボリューム</h2>
          <div className="vol-nav">
            <button
              type="button"
              disabled={weekIdx >= weeks.length - 1}
              onClick={() => setWeekIdx((i) => i + 1)}
              aria-label="前の週"
            >
              ←
            </button>
            <span>{weekLabel(currentWeek)}</span>
            <button
              type="button"
              disabled={weekIdx <= 0}
              onClick={() => setWeekIdx((i) => i - 1)}
              aria-label="次の週"
            >
              →
            </button>
          </div>
        </header>

        <div className="vol-list">
          {REGIONS.map((r) => {
            const rows = volumes.filter((v) => v.region === r.id);
            if (rows.length === 0) return null;
            return (
              <div key={r.id} className="vol-group">
                <span className="vol-region">{r.label}</span>
                {rows.map((v) => (
                  <VolumeBar key={v.group} v={v} />
                ))}
              </div>
            );
          })}
        </div>

        <p className="hint">
          主働筋1.0・協働筋0.5で按分。目安は<b>筋群あたり</b>週{range[0]}〜{range[1]}セット
          （帯の部分）。ウォームアップは集計しません。
        </p>
      </section>

      {/* e1RM 推移（ALG-1 / FR-C1） */}
      <section className="vol">
        <header className="vol-head">
          <h2>推定1RM の推移</h2>
        </header>
        <p className="hint">
          重量 ×（1 +（レップ + RIR）÷ 30）で算出。緑の点は自己ベスト更新。
        </p>
      </section>

      {e1rmRows.map((r) => (
        <article key={r.id} className="prog-card">
          <header>
            <span className="card-code">{r.code}</span>
            <span className="prog-name">{r.name}</span>
          </header>
          <div className="prog-body">
            <div className="prog-nums">
              <div>
                <span className="k">最高 e1RM</span>
                <span className="v">{r.best ? `${formatKg(r.best)}kg` : "—"}</span>
              </div>
              <div>
                <span className="k">セッション</span>
                <span className="v">{r.sessions}</span>
              </div>
            </div>
            <Spark points={r.points} />
          </div>
        </article>
      ))}
    </main>
  );
}
