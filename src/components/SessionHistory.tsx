import { useCallback, useEffect, useState } from "react";
import type { Master } from "../data/master";
import {
  deleteSession,
  deleteSet,
  getSessionSets,
  listSessions,
  type SessionRec,
  type SetLogRec,
} from "../db";
import { formatKg, setE1rm } from "../lib/e1rm";
import { SetEditor } from "./SetEditor";

/**
 * FR-B8 過去の記録の確認と削除。
 *
 * 間違えて記録したものを後から直せないと、e1RMの推移も
 * 週間ボリュームも狂ったままになる。セット行をタップすると値を修正でき、
 * ×で1セット削除、セッションごとの削除もできる。
 * 削除は取り消せないので、セッションごと消すときだけ確認を挟む。
 */

function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function describeSet(s: SetLogRec): string {
  const v = s.unit === "weight_seconds" ? `${s.seconds}秒` : `${s.reps}回`;
  return `${formatKg(s.weight)}kg × ${v} RIR${s.rir}`;
}

export function SessionHistory({ master }: { master: Master }) {
  const [sessions, setSessions] = useState<SessionRec[] | null>(null);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [openId, setOpenId] = useState<string | null>(null);
  const [sets, setSets] = useState<SetLogRec[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = (await listSessions(20)).filter((s) => s.endedAt !== null);
    setSessions(list);
    const c = new Map<string, number>();
    for (const s of list) c.set(s.id, (await getSessionSets(s.id)).length);
    setCounts(c);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setConfirmId(null);
    setEditId(null);
    setSets(await getSessionSets(id));
  };

  if (!sessions) return null;
  if (sessions.length === 0) {
    return <p className="hint">終了したセッションはまだありません。</p>;
  }

  return (
    <section className="history">
      <h2>これまでの記録</h2>
      <ul className="hlist">
        {sessions.map((s) => {
          const isOpen = openId === s.id;
          return (
            <li key={s.id} className={isOpen ? "on" : ""}>
              <button type="button" className="hhead" onClick={() => void open(s.id)}>
                <span className="hdate">{fmtDateTime(s.startedAt)}</span>
                <span className="hcount">{counts.get(s.id) ?? 0} セット</span>
                <span className="hchev">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="hbody">
                  {sets.length === 0 ? (
                    <p className="hint">セットがありません。</p>
                  ) : (
                    <ul className="today-sets">
                      {sets.map((x) => {
                        const ex = master.exercises.find((e) => e.id === x.exerciseId);
                        const v = setE1rm(x);
                        if (editId === x.id) {
                          return (
                            <li key={x.id} className="editing">
                              <SetEditor
                                set={x}
                                exercise={ex}
                                onCancel={() => setEditId(null)}
                                onSaved={async () => {
                                  setEditId(null);
                                  setSets(await getSessionSets(s.id));
                                  await load();
                                }}
                              />
                            </li>
                          );
                        }
                        return (
                          <li key={x.id}>
                            <span className="n">{ex?.code ?? "—"}</span>
                            <button
                              type="button"
                              className="d tap"
                              onClick={() => setEditId(x.id)}
                              aria-label={`${ex?.name ?? x.exerciseId} の記録を修正`}
                            >
                              {ex?.name ?? x.exerciseId}
                              <br />
                              {describeSet(x)}
                            </button>
                            <span className="e">{v ? `e1RM ${formatKg(v)}` : "—"}</span>
                            <button
                              type="button"
                              aria-label="このセットを削除"
                              onClick={async () => {
                                await deleteSet(x.id);
                                setSets(await getSessionSets(s.id));
                                await load();
                              }}
                            >
                              ×
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {confirmId === s.id ? (
                    <div className="hconfirm">
                      <p>このセッションの記録をすべて削除します。取り消せません。</p>
                      <div>
                        <button
                          type="button"
                          className="danger"
                          onClick={async () => {
                            await deleteSession(s.id);
                            setOpenId(null);
                            setConfirmId(null);
                            await load();
                          }}
                        >
                          削除する
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)}>
                          やめる
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="sub-btn danger-outline"
                      onClick={() => setConfirmId(s.id)}
                    >
                      このセッションを削除
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
