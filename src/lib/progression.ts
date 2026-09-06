import type { Exercise } from "../data/types";
import type { ProgressionRec, SetLogRec } from "../db";

/**
 * ALG-3 次回重量の提案（ダブルプログレッション）
 *
 * 条件A：全メインセットで reps >= hi かつ 平均 rir <= 1
 *        → 重量を1段階上げ、レップ目標を lo に戻す
 * 条件B：条件Aを満たさず、reps >= lo を全セットで達成
 *        → 重量据え置き、レップを +1 狙い
 * 条件C：reps < lo のセットが1つ以上ある
 *        → consecutiveFailures += 1
 *           2セッション連続で該当した場合、重量を 10% 下げて再開
 *
 * unit が weight_seconds の種目では reps の代わりに seconds を使う。
 */

export type SuggestionKind = "first" | "up" | "hold" | "down";

export interface Suggestion {
  kind: SuggestionKind;
  /** 履歴が無い場合は null（ユーザーが初回重量を入力する） */
  weight: number | null;
  /** 目標レップ（weight_seconds の種目では秒数） */
  target: number;
  reason: string;
  consecutiveFailures: number;
}

/** 記録から評価に使う値（レップ数、または秒数）を取り出す */
function valueOf(s: SetLogRec): number {
  return s.unit === "weight_seconds" ? (s.seconds ?? 0) : (s.reps ?? 0);
}

/** 0.5kg 刻みに丸める。プレートやマシンの実態に合わせた最小単位。 */
function roundWeight(v: number): number {
  return Math.round(v * 2) / 2;
}

export function suggestNext(
  exercise: Exercise,
  previousMainSets: SetLogRec[],
  state: ProgressionRec | undefined
): Suggestion {
  const [lo, hi] = exercise.repRange;
  const failures = state?.consecutiveFailures ?? 0;

  const sets = previousMainSets.filter((s) => s.type === "main");
  if (sets.length === 0) {
    return {
      kind: "first",
      weight: state?.currentWeight ?? null,
      target: lo,
      reason: "初回。実施できる重量を入力してください。次回からは記録に基づいて提案します。",
      consecutiveFailures: failures,
    };
  }

  const values = sets.map(valueOf);
  const weight = Math.max(...sets.map((s) => s.weight));
  const avgRir = sets.reduce((a, s) => a + s.rir, 0) / sets.length;
  const step = exercise.progressionStepKg;

  const unitLabel = exercise.unit === "weight_seconds" ? "秒" : "回";

  // 条件A
  if (values.every((v) => v >= hi) && avgRir <= 1) {
    if (step <= 0) {
      // 加重手段がない種目（アブローラー等）は難易度で漸進する
      return {
        kind: "hold",
        weight,
        target: hi,
        reason: `全セットで${hi}${unitLabel}に到達。加重できない種目なので、難易度を上げて継続してください。`,
        consecutiveFailures: 0,
      };
    }
    return {
      kind: "up",
      weight: roundWeight(weight + step),
      target: lo,
      reason: `前回は全セット${hi}${unitLabel}に到達し、平均RIR ${avgRir.toFixed(1)}。+${step}kg に上げて${lo}${unitLabel}から。`,
      consecutiveFailures: 0,
    };
  }

  // 条件B
  if (values.every((v) => v >= lo)) {
    const next = Math.min(hi, Math.max(...values) + 1);
    return {
      kind: "hold",
      weight,
      target: next,
      reason: `前回は${Math.min(...values)}〜${Math.max(...values)}${unitLabel}。重量は据え置き、${next}${unitLabel}を狙う。`,
      consecutiveFailures: 0,
    };
  }

  // 条件C
  const nextFailures = failures + 1;
  if (nextFailures >= 2) {
    return {
      kind: "down",
      weight: roundWeight(weight * 0.9),
      target: lo,
      reason: `${lo}${unitLabel}未達が2セッション連続。10%下げて立て直す。`,
      consecutiveFailures: 0,
    };
  }
  return {
    kind: "hold",
    weight,
    target: lo,
    reason: `${lo}${unitLabel}に届かないセットがあった。同じ重量でもう一度。`,
    consecutiveFailures: nextFailures,
  };
}

/**
 * ALG-5 初回開始重量の提案
 *
 *   推定1RM = 体重 × 種目係数 × 経験レベル係数
 *   開始重量 = 推定1RM × repFactor(目標レップ) × 0.9
 *
 * 体格からの推定は精度に限界があるため、初回の当たり付けにのみ使う。
 * 2回目以降は必ず実測ベース（suggestNext）に切り替える。
 */
export type Experience = "beginner" | "intermediate" | "advanced";

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  beginner: "初心者（〜1年）",
  intermediate: "中級者（1〜3年）",
  advanced: "上級者（3年〜）",
};

export function estimateStartWeight(
  exercise: Exercise,
  bodyWeightKg: number,
  experience: Experience
): { weight: number; note: string } | null {
  const coef = exercise.strengthCoefficient;
  if (!coef || !bodyWeightKg) return null;

  const c = coef[experience];
  if (!c) return null;

  const oneRm = bodyWeightKg * c;
  const [lo] = exercise.repRange;
  const factor = 1 / (1 + lo / 30);
  const weight = roundWeight(oneRm * factor * 0.9);

  return {
    weight,
    note: `体重 ${bodyWeightKg}kg × 係数 ${c} から推定した目安。実測ではないので、軽く感じたら上げてください。`,
  };
}
