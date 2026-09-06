import { useCallback, useEffect, useState } from "react";
import type { Master } from "../data/master";
import {
  endSession,
  getOpenSession,
  getSessionSets,
  startSession,
  type SessionRec,
  type SetLogRec,
} from "../db";
import { ExercisePanel } from "../components/ExercisePanel";
import { ExercisePicker } from "../components/ExercisePicker";
import { RestTimer } from "../components/RestTimer";
import { formatMMSS } from "../lib/rest";

function elapsedLabel(from: number, now: number): string {
  return formatMMSS((now - from) / 1000);
}

export function Workout({ master }: { master: Master }) {
  const [session, setSession] = useState<SessionRec | null>(null);
  const [sets, setSets] = useState<SetLogRec[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (s: SessionRec | null) => {
    if (!s) {
      setSets([]);
      return;
    }
    setSets(await getSessionSets(s.id));
  }, []);

  // 中断してもアプリ再起動で復元する（FR-B1）
  useEffect(() => {
    (async () => {
      const s = await getOpenSession();
      setSession(s);
      await refresh(s);
      setLoading(false);
    })();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (loading) {
    return (
      <main className="state">
        <p>読み込み中…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="start">
        <div className="start-box">
          <h2>今日のトレーニング</h2>
          <p>種目を選んでセットを記録すると、次回の重量を提案します。</p>
          <button
            type="button"
            className="log-btn"
            onClick={async () => {
              const s = await startSession();
              setSession(s);
              await refresh(s);
              setPicking(true);
            }}
          >
            トレーニングを開始
          </button>
        </div>
      </main>
    );
  }

  const active = activeId ? master.exercises.find((e) => e.id === activeId) : null;
  const usedIds = [...new Set(sets.map((s) => s.exerciseId))];

  return (
    <main className="workout">
      <div className="sess-head">
        <div>
          <span className="sess-label">セッション</span>
          <span className="sess-time">{elapsedLabel(session.startedAt, now)}</span>
        </div>
        <div className="sess-meta">
          <span>{sets.length} セット</span>
          <button
            type="button"
            onClick={async () => {
              await endSession(session.id);
              setSession(null);
              setActiveId(null);
              setRestEndsAt(null);
              setSets([]);
            }}
          >
            終了
          </button>
        </div>
      </div>

      {active ? (
        <>
          <button type="button" className="back" onClick={() => setActiveId(null)}>
            ← 種目一覧へ
          </button>
          <ExercisePanel
            exercise={active}
            sessionId={session.id}
            todaySets={sets}
            onLogged={() => void refresh(session)}
            onStartRest={(sec) => setRestEndsAt(Date.now() + sec * 1000)}
          />
        </>
      ) : (
        <>
          <button
            type="button"
            className="log-btn"
            onClick={() => setPicking(true)}
          >
            種目を追加
          </button>

          {usedIds.length === 0 ? (
            <p className="hint">まだ記録がありません。種目を選んでください。</p>
          ) : (
            <ul className="done-list">
              {usedIds.map((id) => {
                const ex = master.exercises.find((e) => e.id === id);
                const mine = sets.filter((s) => s.exerciseId === id);
                if (!ex) return null;
                return (
                  <li key={id}>
                    <button type="button" onClick={() => setActiveId(id)}>
                      <span className="card-code">{ex.code}</span>
                      <span className="done-name">{ex.name}</span>
                      <span className="done-meta">{mine.length} セット</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {picking && (
        <ExercisePicker
          master={master}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setActiveId(id);
            setPicking(false);
          }}
        />
      )}

      {restEndsAt !== null && (
        <RestTimer
          endsAt={restEndsAt}
          onDone={() => undefined}
          onDismiss={() => setRestEndsAt(null)}
          onExtend={(sec) => setRestEndsAt((v) => (v ?? Date.now()) + sec * 1000)}
        />
      )}
    </main>
  );
}
