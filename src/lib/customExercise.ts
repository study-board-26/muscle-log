import type { Exercise, Equipment, LogUnit, MuscleRole, Region } from "../data/types";
import { DEFAULT_COEFFICIENT } from "../data/types";

/**
 * FR-A11 自作の種目
 *
 * 収録済みの44種目は、根拠を確認したうえで全項目を埋めてある。
 * 自作の種目に同じ量を入力させるのは現実的でないので、
 * 「これが無いとアルゴリズムが動かない」項目だけを必須にする。
 *
 *   使う筋（主働1つ以上）  ALG-2 のボリューム按分。無いと分析に一切出ない
 *   目標レップ帯           ALG-3 の昇降条件と、レストの推奨秒数
 *   増量幅                 ALG-3 で1段階上げるときの幅
 *   多関節か               ALG-4 のデロード判定の対象と、ALG-7 の所要時間
 *
 * 根拠（evidence）は "custom" 段に置く。既存の4段に混ぜると、
 * 「介入研究」や「原則」というラベルが何も保証しなくなるため。
 */

export interface CustomExerciseInput {
  name: string;
  region: Region;
  equipment: Equipment[];
  unit: LogUnit;
  repRange: [number, number];
  progressionStepKg: number;
  compound: boolean;
  /** muscleId と役割。prime が1つ以上必要 */
  muscles: { muscleId: string; role: MuscleRole }[];
  cues: string[];
  videoUrl: string;
}

export const EMPTY_INPUT: CustomExerciseInput = {
  name: "",
  region: "chest",
  equipment: [],
  unit: "weight_reps",
  repRange: [8, 12],
  progressionStepKg: 2.5,
  compound: false,
  muscles: [],
  cues: [],
  videoUrl: "",
};

/** 入力の不足を日本語で返す。空配列なら保存してよい。 */
export function validateInput(input: CustomExerciseInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("種目名を入れてください");
  if (!input.muscles.some((m) => m.role === "prime")) {
    errors.push("主働筋を1つ以上選んでください（週間ボリュームの集計に使います）");
  }
  const [lo, hi] = input.repRange;
  if (lo < 1 || hi < 1) errors.push("目標レップ帯は1以上にしてください");
  if (lo > hi) errors.push("目標レップ帯の下限が上限を超えています");
  if (input.progressionStepKg <= 0) errors.push("増量幅は0より大きくしてください");
  if (input.videoUrl.trim() && !/^https?:\/\//i.test(input.videoUrl.trim())) {
    errors.push("動画URLは http:// または https:// で始めてください");
  }
  return errors;
}

/** MY-1, MY-2 … 既存の自作種目とぶつからない番号を振る */
export function nextCustomCode(existing: Exercise[]): string {
  const used = new Set(
    existing
      .map((e) => /^MY-(\d+)$/.exec(e.code)?.[1])
      .filter((n): n is string => Boolean(n))
      .map(Number)
  );
  let n = 1;
  while (used.has(n)) n++;
  return `MY-${n}`;
}

function newId(): string {
  return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 入力から Exercise を組み立てる。
 * id と code は保存時に一度だけ決め、あとから変えない。
 * 記録が exerciseId で参照しているので、変えると過去の記録が繋がらなくなる。
 */
export function buildExercise(
  input: CustomExerciseInput,
  existing: Exercise[],
  base?: Exercise
): Exercise {
  const name = input.name.trim();
  const url = input.videoUrl.trim();
  return {
    id: base?.id ?? newId(),
    code: base?.code ?? nextCustomCode(existing),
    name,
    nameEn: "",
    region: input.region,
    equipment: input.equipment,
    alternatives: [],
    unit: input.unit,
    repRange: input.repRange,
    progressionStepKg: input.progressionStepKg,
    muscles: input.muscles.map((m) => ({
      muscleId: m.muscleId,
      role: m.role,
      coefficient: DEFAULT_COEFFICIENT[m.role],
    })),
    evidence: {
      level: "custom",
      refs: [],
      summary: "自分で追加した種目です。効果の根拠は確認していません。",
    },
    cues: input.cues.map((c) => c.trim()).filter(Boolean),
    commonErrors: [],
    criticalNote: null,
    equivalentTo: [],
    phase: 1,
    modelAssetId: "",
    compound: input.compound,
    curated: false,
    video: url ? { url, title: `${name} のフォーム`, channel: "", query: name } : null,
  };
}

/** 保存済みの種目を編集するとき、フォームの初期値に戻す */
export function toInput(exercise: Exercise): CustomExerciseInput {
  return {
    name: exercise.name,
    region: exercise.region,
    equipment: [...exercise.equipment],
    unit: exercise.unit,
    repRange: [...exercise.repRange] as [number, number],
    progressionStepKg: exercise.progressionStepKg,
    compound: exercise.compound,
    muscles: exercise.muscles
      .filter((m) => m.role !== "stabilizer")
      .map((m) => ({ muscleId: m.muscleId, role: m.role })),
    cues: [...exercise.cues],
    videoUrl: exercise.video?.url ?? "",
  };
}

export function isCustom(exercise: Exercise): boolean {
  return exercise.evidence.level === "custom";
}
