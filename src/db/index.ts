import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Exercise, LogUnit } from "../data/types";

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

/** FR-B5 体重。1日1件にするため id は YYYY-MM-DD。 */
export interface BodyWeightRec {
  id: string;
  date: number;
  weight: number;
}

/** FR-E3 ルーティン。個人利用なので有効なものは常に1つ（id は "active"）。 */
export interface RoutineItem {
  exerciseId: string;
  sets: number;
}

export interface RoutineDay {
  /** 0=日 〜 6=土 */
  dayOfWeek: number;
  label: string;
  items: RoutineItem[];
}

export interface RoutineRec {
  id: string;
  name: string;
  days: RoutineDay[];
}

export type Pose = "front" | "back" | "side";

/**
 * FR-B6 体の写真。
 * 画像は Blob のまま端末内に置き、外部へは一切送らない（NFR-5）。
 */
export interface PhotoRec {
  id: string;
  date: number;
  pose: Pose;
  blob: Blob;
  width: number;
  height: number;
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
  bodyWeights: {
    key: string;
    value: BodyWeightRec;
    indexes: { date: number };
  };
  photos: {
    key: string;
    value: PhotoRec;
    indexes: { date: number };
  };
  routines: {
    key: string;
    value: RoutineRec;
  };
  /**
   * 利用者が自分で追加した種目（FR-A11）。
   * 収録済みの44種目は public/data/exercises.json 側にあり、こちらには入らない。
   * 記録は exerciseId でこの id を参照するので、消すと過去の記録が種目名を
   * 引けなくなる。削除は記録が無いときだけ許す。
   */
  customExercises: {
    key: string;
    value: Exercise;
  };
}

const DB_NAME = "muscle-log";
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<MuscleLogDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MuscleLogDB>(DB_NAME, DB_VERSION, {
      // 既存の記録を消さずに移行できるよう、版ごとに追加分だけを作る
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const sessions = db.createObjectStore("sessions", { keyPath: "id" });
          sessions.createIndex("startedAt", "startedAt");

          const setLogs = db.createObjectStore("setLogs", { keyPath: "id" });
          setLogs.createIndex("sessionId", "sessionId");
          setLogs.createIndex("exerciseId", "exerciseId");
          setLogs.createIndex("exerciseId+loggedAt", ["exerciseId", "loggedAt"]);

          db.createObjectStore("progression", { keyPath: "exerciseId" });
          db.createObjectStore("settings", { keyPath: "key" });
        }
        if (oldVersion < 2) {
          const bw = db.createObjectStore("bodyWeights", { keyPath: "id" });
          bw.createIndex("date", "date");

          const ph = db.createObjectStore("photos", { keyPath: "id" });
          ph.createIndex("date", "date");
        }
        if (oldVersion < 3) {
          db.createObjectStore("routines", { keyPath: "id" });
        }
        if (oldVersion < 4) {
          db.createObjectStore("customExercises", { keyPath: "id" });
        }
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

/**
 * FR-B8 セッションを丸ごと削除する。
 * ぶら下がるセットも同じトランザクションで消す。
 * 片方だけ残ると、どの画面にも出ないのに集計にだけ効く記録になるため。
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "setLogs"], "readwrite");
  const sets = await tx.objectStore("setLogs").index("sessionId").getAllKeys(sessionId);
  for (const key of sets) await tx.objectStore("setLogs").delete(key);
  await tx.objectStore("sessions").delete(sessionId);
  await tx.done;
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

/**
 * FR-B8 記録した値を後から修正する。
 *
 * 修正できるのは入力値（重量・レップ・秒数・RIR）だけで、
 * 種目やセッションの付け替えはできない。付け替えを許すと
 * e1RM の推移と週間ボリュームの整合を保つのが難しくなるため、
 * 種目を間違えた場合は削除して記録し直す。
 *
 * loggedAt は変えない。並び順と、前回記録・デロード判定の
 * 時系列がずれるため。
 */
export async function updateSet(
  id: string,
  patch: Partial<Pick<SetLogRec, "weight" | "reps" | "seconds" | "rir">>
): Promise<void> {
  const db = await getDB();
  const rec = await db.get("setLogs", id);
  if (!rec) return;
  await db.put("setLogs", { ...rec, ...patch });
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

/* ---------- ルーティン（FR-E1 / FR-E3） ---------- */

export async function getRoutine(): Promise<RoutineRec | undefined> {
  const db = await getDB();
  return db.get("routines", "active");
}

export async function putRoutine(rec: RoutineRec): Promise<void> {
  const db = await getDB();
  await db.put("routines", { ...rec, id: "active" });
}

export async function clearRoutine(): Promise<void> {
  const db = await getDB();
  await db.delete("routines", "active");
}

/* ---------- 体重（FR-B5） ---------- */

/** 1日1件にするためのキー */
export function dayKey(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function putBodyWeight(weight: number, at = Date.now()): Promise<void> {
  const db = await getDB();
  await db.put("bodyWeights", { id: dayKey(at), date: at, weight });
}

export async function listBodyWeights(): Promise<BodyWeightRec[]> {
  const db = await getDB();
  return (await db.getAllFromIndex("bodyWeights", "date")).sort((a, b) => a.date - b.date);
}

export async function deleteBodyWeight(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("bodyWeights", id);
}

/* ---------- 写真（FR-B6） ---------- */

export async function addPhoto(
  blob: Blob,
  pose: Pose,
  width: number,
  height: number,
  at = Date.now()
): Promise<PhotoRec> {
  const db = await getDB();
  const rec: PhotoRec = { id: newId(), date: at, pose, blob, width, height };
  await db.put("photos", rec);
  return rec;
}

export async function listPhotos(): Promise<PhotoRec[]> {
  const db = await getDB();
  return (await db.getAllFromIndex("photos", "date")).sort((a, b) => b.date - a.date);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("photos", id);
}

/* ---------- 自作の種目（FR-A11） ---------- */

export async function getCustomExercises(): Promise<Exercise[]> {
  const db = await getDB();
  return db.getAll("customExercises");
}

export async function putCustomExercise(exercise: Exercise): Promise<void> {
  const db = await getDB();
  await db.put("customExercises", exercise);
}

/**
 * 記録がぶら下がっている種目は消せない。
 * 消すと e1RM の推移も週間ボリュームも、種目名を引けない記録を抱えることになる。
 * FR-B8 で種目の付け替えを許していないのと同じ理由。
 */
export async function countSetsForExercise(exerciseId: string): Promise<number> {
  const db = await getDB();
  return db.countFromIndex("setLogs", "exerciseId", exerciseId);
}

export async function deleteCustomExercise(exerciseId: string): Promise<void> {
  const db = await getDB();
  await db.delete("customExercises", exerciseId);
}

/* ---------- エクスポート（FR-F2） ---------- */

/**
 * 写真は含めない。JSONに埋めるとテキストが肥大して扱えなくなるため、
 * 写真は端末内に置いたまま、件数だけを記録しておく。
 */
export async function exportAll(): Promise<string> {
  const db = await getDB();
  const [sessions, setLogs, progression, settings, bodyWeights, customExercises, photoCount] =
    await Promise.all([
      db.getAll("sessions"),
      db.getAll("setLogs"),
      db.getAll("progression"),
      db.getAll("settings"),
      db.getAll("bodyWeights"),
      db.getAll("customExercises"),
      db.count("photos"),
    ]);
  const routine = await db.get("routines", "active");
  return JSON.stringify(
    {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      sessions,
      setLogs,
      progression,
      settings,
      bodyWeights,
      customExercises,
      routine: routine ?? null,
      photos: { count: photoCount, note: "写真は端末内にのみ保存され、書き出しに含まれません" },
    },
    null,
    2
  );
}
