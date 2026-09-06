import type { Exercise } from "../data/types";
import type { SetLogRec } from "../db";
// Node の ESM は拡張子を省略できないため明示する。
// tsconfig の allowImportingTsExtensions が有効なので型チェックも通る。
import { setE1rm } from "./e1rm.ts";

/**
 * ALG-4 デロード判定
 *
 * 睡眠・主観疲労を入力に持たないため、判定は客観指標2つのAND条件で行う。
 *
 *   条件1：直近3セッションで e1RM の自己ベスト更新がない
 *   条件2：同一重量帯における平均RIRが、4週間前と比べて 1.0 以上低下
 *
 * これを満たす主要種目（多関節）が2種目以上でデロードを提案する。
 *
 * 主観入力がないぶん、体調不良や生活由来の疲労は検知できない。
 * 提案は「そろそろ落としませんか」という提示に留め、強制はしない。
 */

const DAY = 86400000;

/** 判定に必要な最低セッション数。これ未満なら評価しない。 */
export const MIN_SESSIONS = 4;
/** 最終デロードからこの期間は再提案しない */
export const REPROPOSE_COOLDOWN_DAYS = 21;

export interface ExerciseFatigue {
  exerciseId: string;
  name: string;
  stalled: boolean;
  rirDrop: number | null;
  flagged: boolean;
}

export interface DeloadVerdict {
  suggest: boolean;
  flagged: ExerciseFatigue[];
  /** 評価できなかった理由。提案しない場合に表示する */
  reason: string;
}

function bySession(sets: SetLogRec[]): Map<string, SetLogRec[]> {
  const m = new Map<string, SetLogRec[]>();
  for (const s of sets) {
    const list = m.get(s.sessionId) ?? [];
    list.push(s);
    m.set(s.sessionId, list);
  }
  return m;
}

/** 条件1：直近3セッションで自己ベストを更新していない */
function isStalled(sets: SetLogRec[]): boolean {
  const sessions = [...bySession(sets).entries()]
    .map(([id, list]) => ({
      id,
      at: Math.max(...list.map((s) => s.loggedAt)),
      best: Math.max(
        0,
        ...list.map((s) => setE1rm(s) ?? 0)
      ),
    }))
    .filter((s) => s.best > 0)
    .sort((a, b) => a.at - b.at);

  if (sessions.length < MIN_SESSIONS) return false;

  const recent = sessions.slice(-3);
  const earlierBest = Math.max(...sessions.slice(0, -3).map((s) => s.best));
  return recent.every((s) => s.best <= earlierBest);
}

/**
 * 条件2：同一重量帯での平均RIRの低下量
 *
 * 直近2週間と、3〜6週間前を比べる。
 * 重量が違えばRIRも当然変わるので、直近の中央重量の ±5% に絞って比較する。
 * どちらかの窓のセット数が足りなければ判定しない（null を返す）。
 */
function rirDrop(sets: SetLogRec[], now: number): number | null {
  const main = sets.filter((s) => s.type === "main" && s.unit === "weight_reps");

  const recent = main.filter((s) => s.loggedAt >= now - 14 * DAY);
  const base = main.filter(
    (s) => s.loggedAt < now - 21 * DAY && s.loggedAt >= now - 42 * DAY
  );
  if (recent.length < 2 || base.length < 2) return null;

  const weights = recent.map((s) => s.weight).sort((a, b) => a - b);
  const median = weights[Math.floor(weights.length / 2)];
  const near = (s: SetLogRec) => Math.abs(s.weight - median) <= median * 0.05;

  const r = recent.filter(near);
  const b = base.filter(near);
  if (r.length < 2 || b.length < 2) return null;

  const avg = (list: SetLogRec[]) => list.reduce((a, s) => a + s.rir, 0) / list.length;
  return avg(b) - avg(r);
}

export function evaluateDeload(
  setsByExercise: Map<string, SetLogRec[]>,
  exercises: Exercise[],
  now: number,
  lastDeloadAt: number | null
): DeloadVerdict {
  if (lastDeloadAt !== null && now - lastDeloadAt < REPROPOSE_COOLDOWN_DAYS * DAY) {
    const days = Math.ceil((REPROPOSE_COOLDOWN_DAYS * DAY - (now - lastDeloadAt)) / DAY);
    return { suggest: false, flagged: [], reason: `前回のデロードから間もないため、あと${days}日は判定しません。` };
  }

  const results: ExerciseFatigue[] = [];
  for (const ex of exercises) {
    if (!ex.compound) continue;
    const sets = setsByExercise.get(ex.id);
    if (!sets || sets.length === 0) continue;

    const stalled = isStalled(sets);
    const drop = rirDrop(sets, now);
    results.push({
      exerciseId: ex.id,
      name: ex.name,
      stalled,
      rirDrop: drop,
      flagged: stalled && drop !== null && drop >= 1.0,
    });
  }

  const flagged = results.filter((r) => r.flagged);
  if (flagged.length >= 2) {
    return {
      suggest: true,
      flagged,
      reason: `${flagged.length}種目で、自己ベストの停滞と同一重量でのRIR低下が同時に出ています。`,
    };
  }

  if (results.length === 0) {
    return { suggest: false, flagged: [], reason: "多関節種目の記録がまだありません。" };
  }
  return {
    suggest: false,
    flagged,
    reason:
      flagged.length === 1
        ? "1種目に疲労の兆候がありますが、2種目以上で判定するため提案は見送ります。"
        : "疲労の蓄積を示す兆候は出ていません。",
  };
}

/** デロード週の実施内容 */
export const DELOAD_GUIDE = {
  days: 7,
  setMultiplier: 0.5,
  targetRir: 3,
  text: "1週間、各種目のセット数を約半分にします。重量は落とさず、RIR 3以上（余力を残す）で終えてください。",
};
