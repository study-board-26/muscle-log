import { useCallback, useEffect, useState } from "react";
import type { Master } from "../data/master";
import {
  endSession,
  getOpenSession,
  getRoutine,
  getSessionSets,
  startSession,
  type RoutineRec,
  type SessionRec,
  type SetLogRec,
} from "../db";
import { ExercisePanel } from "../components/ExercisePanel";
import { ExercisePicker } from "../components/ExercisePicker";
import { RestTimer } from "../components/RestTimer";
import { SessionHistory } from "../components/SessionHistory";
import { RoutineSheet } from "../components/RoutineSheet";
import { TodayMenu, todayIndex } from "../components/TodayMenu";
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
  const [routine, setRoutine] = useState<RoutineRec | null>(null);
  const [editingRoutine, setEditingRoutine] = useState(false);

  const refresh = useCallback(async (s: SessionRec | null) => {
    if (!s) {
      setSets([]);
      return;
    }
    setSets(await getSessionSets(s.id));
  }, []);

  const loadRoutine = useCallback(async () => {
    setRoutine((await getRoutine()) ?? null);
  }, []);

  // 中断してもアプリ再起動で復元する（FR-B1）
  useEffect(() => {
    (async () => {
      const s = await getOpenSession();
      setSession(s);
      await refresh(s);
      await loadRoutine();
      setLoading(false);
    })();
  }, [refresh, loadRoutine]);

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
        <TodayMenu
          master={master}
          routine={routine}
          onOpenRoutine={() => setEditingRoutine(true)}
        />

        <div className="start-box">
          <button
            type="button"
            className="log-btn"
            onClick={async () => {
              const s = await startSession();
              setSession(s);
              await refresh(s);
              // ルーティンがある日は種目が決まっているので、選択画面は出さない
              const hasMenu = routine !== null && todayIndex(routine) >= 0;
              if (!hasMenu) setPicking(true);
            }}
          >
            トレーニングを開始
          </button>
        </div>

        {/* 間違えて記録したものを後から消せるようにする（FR-B8） */}
        <SessionHistory master={master} />

        {editingRoutine && (
          <RoutineSheet
            master={master}
            routine={routine}
            onSaved={() => void loadRoutine()}
            onClose={() => setEditingRoutine(false)}
          />
        )}
      </main>
    );
  }

  const active = activeId ? master.exercises.find((e) => e.id === activeId) : null;

  /*
   * セッション中の一覧は、今日のルーティンの種目を先に並べ、
   * その場で追加した種目を後ろに足す。
   * ルーティン種目は未着手でも出すので、上から順に潰していける。
   */
  const di = routine ? todayIndex(routine) : -1;
  const planned = di >= 0 && routine ? routine.days[di].items : [];
  const plannedIds = planned.map((i) => i.exerciseId);
  const extraIds = [...new Set(sets.map((s) => s.exerciseId))].filter(
    (id) => !plannedIds.includes(id)
  );
  const listRows = [
    ...planned.map((i) => ({ id: i.exerciseId, target: i.sets })),
    ...extraIds.map((id) => ({ id, target: 0 })),
  ];

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

          {listRows.length === 0 ? (
            <p className="hint">まだ記録がありません。種目を選んでください。</p>
          ) : (
            <ul className="done-list">
              {listRows.map((row) => {
                const ex = master.exercises.find((e) => e.id === row.id);
                const done = sets.filter((s) => s.exerciseId === row.id).length;
                if (!ex) return null;
                const complete = row.target > 0 && done >= row.target;
                return (
                  <li key={row.id} className={complete ? "done" : ""}>
                    <button type="button" onClick={() => setActiveId(row.id)}>
                      <span className="card-code">{ex.code}</span>
                      <span className="done-name">{ex.name}</span>
                      <span className="done-meta">
                        {row.target > 0 ? `${done} / ${row.target}` : `${done}`} セット
                        {complete && <span className="done-tick">✓</span>}
                      </span>
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
