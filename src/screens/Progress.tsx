import { useEffect, useState } from "react";
import type { Master } from "../data/master";
import { getExerciseSets, type SetLogRec } from "../db";
import { bestE1rm, e1rmSeries, formatKg, type E1rmPoint } from "../lib/e1rm";

interface Row {
  exerciseId: string;
  code: string;
  name: string;
  points: E1rmPoint[];
  best: number | null;
  sessions: number;
  lastAt: number;
}

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

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.at).toFixed(1)},${py(p.value).toFixed(1)}`).join(" ");
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

export function Progress({ master }: { master: Master }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const out: Row[] = [];
      for (const ex of master.exercises) {
        const sets: SetLogRec[] = await getExerciseSets(ex.id);
        if (sets.length === 0) continue;
        const points = e1rmSeries(sets);
        out.push({
          exerciseId: ex.id,
          code: ex.code,
          name: ex.name,
          points,
          best: bestE1rm(sets),
          sessions: new Set(sets.map((s) => s.sessionId)).size,
          lastAt: Math.max(...sets.map((s) => s.loggedAt)),
        });
      }
      out.sort((a, b) => b.lastAt - a.lastAt);
      setRows(out);
    })();
  }, [master]);

  if (!rows) {
    return (
      <main className="state">
        <p>読み込み中…</p>
      </main>
    );
  }

  if (rows.length === 0) {
    return (
      <main className="state">
        <p>まだ記録がありません。</p>
        <p className="hint">
          記録タブでセットを保存すると、ここに推定1RM（e1RM）の推移が出ます。
        </p>
      </main>
    );
  }

  return (
    <main className="progress">
      <p className="hint">
        推定1RM は 重量 ×（1 + (レップ + RIR) ÷ 30）で算出。緑の点は自己ベスト更新。
      </p>
      {rows.map((r) => (
        <article key={r.exerciseId} className="prog-card">
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
