import { useCallback, useEffect, useState } from "react";
import type { Master } from "../data/master";
import {
  dayKey,
  deleteSession,
  deleteSet,
  getAllSets,
  listSessions,
  type SessionRec,
  type SetLogRec,
} from "../db";
import { formatKg, setE1rm } from "../lib/e1rm";
import { SetEditor } from "./SetEditor";

/**
 * FR-B8 過去の記録の確認・修正・削除。
 *
 * 日付ごとにまとめ、その日にやった種目とセット数を畳んだ状態でも見せる。
 * セッション単位で並べると「いつ何をやったか」が一覧で追えないため。
 * 1日に複数セッションを記録した場合は、同じ日の中にまとめる。
 *
 * セット行をタップすると値を修正でき、×で1セット削除できる。
 * 削除は取り消せないので、セッションごと消すときだけ確認を挟む。
 */

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}（${DOW[d.getDay()]}）`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function describeSet(s: SetLogRec): string {
  const v = s.unit === "weight_seconds" ? `${s.seconds}秒` : `${s.reps}回`;
  return `${formatKg(s.weight)}kg × ${v} RIR${s.rir}`;
}

interface SessionEntry {
  session: SessionRec;
  sets: SetLogRec[];
}

interface DayGroup {
  key: string;
  date: number;
  entries: SessionEntry[];
  totalSets: number;
  /** その日にやった種目と、そのセット数 */
  exercises: { id: string; code: string; name: string; sets: number }[];
}

export function SessionHistory({ master }: { master: Master }) {
  const [days, setDays] = useState<DayGroup[] | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [sessions, allSets] = await Promise.all([listSessions(60), getAllSets()]);

    const bySession = new Map<string, SetLogRec[]>();
    for (const s of allSets) {
      const list = bySession.get(s.sessionId) ?? [];
      list.push(s);
      bySession.set(s.sessionId, list);
    }

    const map = new Map<string, DayGroup>();
    for (const session of sessions) {
      if (session.endedAt === null) continue; // 進行中は履歴に出さない
      const sets = bySession.get(session.id) ?? [];
      const key = dayKey(session.startedAt);

      let g = map.get(key);
      if (!g) {
        g = { key, date: session.startedAt, entries: [], totalSets: 0, exercises: [] };
        map.set(key, g);
      }
      g.entries.push({ session, sets });
      g.totalSets += sets.length;
    }

    // 種目ごとのセット数をまとめる。並びは実際にやった順。
    for (const g of map.values()) {
      const order: string[] = [];
      const count = new Map<string, number>();
      for (const e of [...g.entries].reverse()) {
        for (const s of e.sets) {
          if (!count.has(s.exerciseId)) order.push(s.exerciseId);
          count.set(s.exerciseId, (count.get(s.exerciseId) ?? 0) + 1);
        }
      }
      g.exercises = order.map((id) => {
        const ex = master.exercises.find((e) => e.id === id);
        return {
          id,
          code: ex?.code ?? "—",
          name: ex?.name ?? id,
          sets: count.get(id) ?? 0,
        };
      });
      g.entries.sort((a, b) => b.session.startedAt - a.session.startedAt);
    }

    setDays([...map.values()].sort((a, b) => b.date - a.date));
  }, [master]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!days) return null;
  if (days.length === 0) {
    return (
      <section className="history">
        <h2>これまでの記録</h2>
        <p className="hint">終了したセッションはまだありません。</p>
      </section>
    );
  }

  return (
    <section className="history">
      <h2>これまでの記録</h2>
      <ul className="hlist">
        {days.map((g) => {
          const isOpen = openKey === g.key;
          return (
            <li key={g.key} className={isOpen ? "on" : ""}>
              <button
                type="button"
                className="hhead"
                onClick={() => {
                  setOpenKey(isOpen ? null : g.key);
                  setConfirmId(null);
                  setEditId(null);
                }}
                aria-expanded={isOpen}
              >
                <span className="hdate">{fmtDay(g.date)}</span>
                <span className="hcount">
                  {g.totalSets} セット
                  {g.entries.length > 1 && `・${g.entries.length}回`}
                </span>
                <span className="hchev">{isOpen ? "▲" : "▼"}</span>
              </button>

              {/* 畳んだ状態でも、その日にやった種目が分かるようにする */}
              {g.exercises.length > 0 ? (
                <ul className="dsum">
                  {g.exercises.map((e) => (
                    <li key={e.id}>
                      <span className="card-code">{e.code}</span>
                      <span className="dsum-name">{e.name}</span>
                      <span className="dsum-sets">×{e.sets}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dsum-none">記録なし</p>
              )}

              {isOpen && (
                <div className="hbody">
                  {g.entries.map(({ session, sets }) => (
                    <div key={session.id} className="hsession">
                      {g.entries.length > 1 && (
                        <p className="hstime">{fmtTime(session.startedAt)} 開始</p>
                      )}

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

                      {confirmId === session.id ? (
                        <div className="hconfirm">
                          <p>
                            {fmtDay(session.startedAt)}
                            {g.entries.length > 1 && ` ${fmtTime(session.startedAt)}`}
                            の記録をすべて削除します。取り消せません。
                          </p>
                          <div>
                            <button
                              type="button"
                              className="danger"
                              onClick={async () => {
                                await deleteSession(session.id);
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
                          onClick={() => setConfirmId(session.id)}
                        >
                          この記録を削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
