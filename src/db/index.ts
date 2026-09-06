import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LogUnit } from "../data/types";

/**
 * 記録は端末内の IndexedDB にのみ保存する。
 * オフラインで全ての記録操作が完了する必要があるため（NFR-1 / FR-B9）、
 * サーバへの書き込みは行わない。
 *
 * iOS はホーム画面に追加していないサイトの保存データを7日で削除するため、
 * この DB の内容は「ホーム画面に追加済み」であることが前提になる（NFR-9）。
 */

export interface SessionRec {
  id: string;
  startedAt: number;
  endedAt: number | null;
  note?: string;
}

export interface SetLogRec {
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  type: "warmup" | "main";
  unit: LogUnit;
  weight: number;
  /** unit が weight_reps のとき使う */
  reps: number | null;
  /** unit が weight_seconds のとき使う */
  seconds: number | null;
  rir: number;
  side: "both" | "L" | "R";
  restSec: number | null;
  loggedAt: number;
  note?: string;
}

export interface ProgressionRec {
  exerciseId: string;
  currentWeight: number;
  currentRepTarget: number;
  consecutiveFailures: number;
  lastDeloadAt: number | null;
  updatedAt: number;
}

export interface SettingsRec {
  key: string;
  value: unknown;
}

interface MuscleLogDB extends DBSchema {
  sessions: {
    key: string;
    value: SessionRec;
    indexes: { startedAt: number };
  };
  setLogs: {
    key: string;
    value: SetLogRec;
    indexes: {
      sessionId: string;
      exerciseId: string;
      "exerciseId+loggedAt": [string, number];
    };
  };
  progression: {
    key: string;
    value: ProgressionRec;
  };
  settings: {
    key: string;
    value: SettingsRec;
  };
}

const DB_NAME = "muscle-log";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MuscleLogDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MuscleLogDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("startedAt", "startedAt");

        const setLogs = db.createObjectStore("setLogs", { keyPath: "id" });
        setLogs.createIndex("sessionId", "sessionId");
        setLogs.createIndex("exerciseId", "exerciseId");
        setLogs.createIndex("exerciseId+loggedAt", ["exerciseId", "loggedAt"]);

        db.createObjectStore("progression", { keyPath: "exerciseId" });
        db.createObjectStore("settings", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- セッション ---------- */

export async function getOpenSession(): Promise<SessionRec | null> {
  const db = await getDB();
  const all = await db.getAllFromIndex("sessions", "startedAt");
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].endedAt === null) return all[i];
  }
  return null;
}

export async function startSession(): Promise<SessionRec> {
  const db = await getDB();
  const rec: SessionRec = { id: newId(), startedAt: Date.now(), endedAt: null };
  await db.put("sessions", rec);
  return rec;
}

export async function endSession(id: string): Promise<void> {
  const db = await getDB();
  const rec = await db.get("sessions", id);
  if (rec) await db.put("sessions", { ...rec, endedAt: Date.now() });
}

export async function listSessions(limit = 30): Promise<SessionRec[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("sessions", "startedAt");
  return all.reverse().slice(0, limit);
}

/* ---------- セット ---------- */

export async function addSet(
  rec: Omit<SetLogRec, "id" | "loggedAt">
): Promise<SetLogRec> {
  const db = await getDB();
  const full: SetLogRec = { ...rec, id: newId(), loggedAt: Date.now() };
  await db.put("setLogs", full);
  return full;
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("setLogs", id);
}

export async function getSessionSets(sessionId: string): Promise<SetLogRec[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("setLogs", "sessionId", sessionId);
  return rows.sort((a, b) => a.loggedAt - b.loggedAt);
}

/** 全ての記録を古い順に返す。ボリューム集計（ALG-2）で使う。 */
export async function getAllSets(): Promise<SetLogRec[]> {
  const db = await getDB();
  const rows = await db.getAll("setLogs");
  return rows.sort((a, b) => a.loggedAt - b.loggedAt);
}

/** その種目の全記録を古い順に返す */
export async function getExerciseSets(exerciseId: string): Promise<SetLogRec[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("setLogs", "exerciseId", exerciseId);
  return rows.sort((a, b) => a.loggedAt - b.loggedAt);
}

/**
 * 直近の「別セッション」でのその種目のセットを返す。
 * 入力画面に常時表示する前回記録（FR-B3）の元データ。
 */
export async function getPreviousSets(
  exerciseId: string,
  currentSessionId: string | null
): Promise<{ sessionId: string; sets: SetLogRec[] } | null> {
  const rows = await getExerciseSets(exerciseId);
  const bySession = new Map<string, SetLogRec[]>();
  for (const r of rows) {
    if (r.sessionId === currentSessionId) continue;
    const list = bySession.get(r.sessionId) ?? [];
    list.push(r);
    bySession.set(r.sessionId, list);
  }
  if (bySession.size === 0) return null;

  let latest: { sessionId: string; sets: SetLogRec[] } | null = null;
  for (const [sessionId, sets] of bySession) {
    const t = Math.max(...sets.map((s) => s.loggedAt));
    if (!latest || t > Math.max(...latest.sets.map((s) => s.loggedAt))) {
      latest = { sessionId, sets };
    }
  }
  return latest;
}

/* ---------- 漸進の状態 ---------- */

export async function getProgression(
  exerciseId: string
): Promise<ProgressionRec | undefined> {
  const db = await getDB();
  return db.get("progression", exerciseId);
}

export async function putProgression(rec: ProgressionRec): Promise<void> {
  const db = await getDB();
  await db.put("progression", { ...rec, updatedAt: Date.now() });
}

/* ---------- 設定 ---------- */

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const rec = await db.get("settings", key);
  return rec?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key, value });
}

/* ---------- エクスポート（FR-F2） ---------- */

export async function exportAll(): Promise<string> {
  const db = await getDB();
  const [sessions, setLogs, progression, settings] = await Promise.all([
    db.getAll("sessions"),
    db.getAll("setLogs"),
    db.getAll("progression"),
    db.getAll("settings"),
  ]);
  return JSON.stringify(
    { version: DB_VERSION, exportedAt: new Date().toISOString(), sessions, setLogs, progression, settings },
    null,
    2
  );
}
