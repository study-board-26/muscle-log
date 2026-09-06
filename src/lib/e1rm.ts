import type { SetLogRec } from "../db";

/**
 * ALG-1 推定1RM（e1RM）
 *
 * RIR ぶんの余力を「実施できたはずのレップ」とみなし、Epley 式で換算する。
 *   effReps = reps + rir
 *   e1RM    = weight × (1 + effReps / 30)
 *
 * 有効レップが12を超える範囲では誤差が大きくなるため、算出対象から除外する。
 */
export const EFF_REPS_LIMIT = 12;

export function e1rm(weight: number, reps: number, rir: number): number | null {
  const effReps = reps + rir;
  if (effReps > EFF_REPS_LIMIT) return null;
  if (weight <= 0 || reps <= 0) return null;
  return weight * (1 + effReps / 30);
}

export function setE1rm(s: SetLogRec): number | null {
  if (s.unit !== "weight_reps" || s.reps === null) return null;
  if (s.type !== "main") return null;
  return e1rm(s.weight, s.reps, s.rir);
}

/** ALG-1 の逆算。目標レップ帯へ換算するときに使う（ALG-5 の repFactor） */
export function repFactor(reps: number): number {
  return 1 / (1 + reps / 30);
}

export interface E1rmPoint {
  sessionId: string;
  at: number;
  value: number;
  isBest: boolean;
}

/**
 * セッション単位の最良 e1RM を時系列で返す。
 * 自己ベスト更新点にマークを付ける（FR-C1）。
 */
export function e1rmSeries(sets: SetLogRec[]): E1rmPoint[] {
  const bySession = new Map<string, { at: number; best: number }>();

  for (const s of sets) {
    const v = setE1rm(s);
    if (v === null) continue;
    const cur = bySession.get(s.sessionId);
    if (!cur || v > cur.best) {
      bySession.set(s.sessionId, { at: s.loggedAt, best: v });
    }
  }

  const points = [...bySession.entries()]
    .map(([sessionId, v]) => ({ sessionId, at: v.at, value: v.best, isBest: false }))
    .sort((a, b) => a.at - b.at);

  let running = 0;
  for (const p of points) {
    if (p.value > running) {
      p.isBest = true;
      running = p.value;
    }
  }
  return points;
}

/** 全記録中の最高 e1RM */
export function bestE1rm(sets: SetLogRec[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    const v = setE1rm(s);
    if (v !== null && (best === null || v > best)) best = v;
  }
  return best;
}

export function formatKg(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
}
