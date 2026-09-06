import { useEffect, useMemo, useState } from "react";
import type { Exercise, Region } from "./data/types";
import {
  EQUIPMENT_LABEL,
  EVIDENCE_LABEL,
  REGIONS,
  ROLE_LABEL,
  loadMaster,
  type Master,
} from "./data/master";

/**
 * iOS Safari は、ホーム画面に追加していないサイトの保存データを
 * 7日間の未使用で削除する。記録が消えるため、追加を促す必要がある（NFR-9）。
 */
function useStandalone(): boolean {
  return useMemo(() => {
    const iosStandalone = (
      window.navigator as Navigator & { standalone?: boolean }
    ).standalone;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      iosStandalone === true
    );
  }, []);
}

function InstallNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside className="notice">
      <p className="notice-title">ホーム画面に追加してください</p>
      <p>
        このまま Safari で使うと、<b>7日間開かないと記録が消えます</b>。
        共有ボタンから「ホーム画面に追加」を選ぶと、データが保持されます。
      </p>
      <button type="button" onClick={() => setDismissed(true)}>
        閉じる
      </button>
    </aside>
  );
}

function ExerciseCard({
  exercise,
  master,
  open,
  onToggle,
}: {
  exercise: Exercise;
  master: Master;
  open: boolean;
  onToggle: () => void;
}) {
  const primes = exercise.muscles.filter((m) => m.role === "prime");
  const repLabel =
    exercise.unit === "weight_seconds"
      ? `${exercise.repRange[0]}〜${exercise.repRange[1]} 秒`
      : `${exercise.repRange[0]}〜${exercise.repRange[1]} 回`;

  return (
    <article className={`card${open ? " open" : ""}`}>
      <button type="button" className="card-head" onClick={onToggle} aria-expanded={open}>
        <span className="card-code">{exercise.code}</span>
        <span className="card-name">{exercise.name}</span>
        <span className="card-meta">
          <span className={`chip ev-${exercise.evidence.level}`}>
            {EVIDENCE_LABEL[exercise.evidence.level]}
          </span>
          {exercise.phase === 1 && <span className="chip phase">P1</span>}
        </span>
        <span className="card-sub">
          {primes.map((m) => master.muscleById.get(m.muscleId)?.nameJa).join("・")}
          <span className="dot">·</span>
          {repLabel}
        </span>
      </button>

      {open && (
        <div className="card-body">
          {exercise.criticalNote && (
            <p className="critical">{exercise.criticalNote}</p>
          )}

          <dl className="kv">
            <dt>器具</dt>
            <dd>
              {exercise.equipment.map((e) => (
                <span key={e} className="chip eq">
                  {EQUIPMENT_LABEL[e] ?? e}
                </span>
              ))}
            </dd>

            <dt>使う筋</dt>
            <dd className="muscles">
              {exercise.muscles.map((m) => (
                <span key={m.muscleId} className={`muscle role-${m.role}`}>
                  {master.muscleById.get(m.muscleId)?.nameJa ?? m.muscleId}
                  <small>{ROLE_LABEL[m.role]}</small>
                </span>
              ))}
            </dd>

            <dt>漸進幅</dt>
            <dd>
              {exercise.progressionStepKg > 0
                ? `+${exercise.progressionStepKg} kg`
                : "加重なし（難易度で漸進）"}
            </dd>
          </dl>

          <section className="block">
            <h3>根拠</h3>
            <p>{exercise.evidence.summary}</p>
            {exercise.evidence.refs.length > 0 && (
              <ul className="refs">
                {exercise.evidence.refs.map((id) => {
                  const r = master.referenceById.get(id);
                  if (!r) return null;
                  return (
                    <li key={id}>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.citation}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="block">
            <h3>効かせるコツ</h3>
            <ul>
              {exercise.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>

          <section className="block">
            <h3>よくある失敗</h3>
            <ul>
              {exercise.commonErrors.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </article>
  );
}

export default function App() {
  const [master, setMaster] = useState<Master | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<Region>("chest");
  const [openId, setOpenId] = useState<string | null>(null);
  const standalone = useStandalone();

  useEffect(() => {
    loadMaster().then(setMaster).catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main className="state">
        <p className="err">{error}</p>
      </main>
    );
  }
  if (!master) {
    return (
      <main className="state">
        <p>種目マスタを読み込んでいます…</p>
      </main>
    );
  }

  const list = master.exercises.filter((e) => e.region === region);

  return (
    <>
      <header className="app-head">
        <h1>筋トレ記録</h1>
        <p className="sub">
          種目 {master.exercises.length}　筋 {master.muscles.length}　文献{" "}
          {master.references.length}
        </p>
      </header>

      <main>
        {!standalone && <InstallNotice />}

        <nav className="tabs" aria-label="部位">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === region ? "on" : ""}
              onClick={() => {
                setRegion(r.id);
                setOpenId(null);
              }}
            >
              {r.label}
            </button>
          ))}
        </nav>

        <div className="list">
          {list.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              master={master}
              open={openId === ex.id}
              onToggle={() => setOpenId(openId === ex.id ? null : ex.id)}
            />
          ))}
        </div>

        <footer className="app-foot">
          <p>
            Phase 1。この画面は種目マスタの確認用で、記録機能はこれから実装する。
          </p>
        </footer>
      </main>
    </>
  );
}
