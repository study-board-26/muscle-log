import type { Exercise } from "../data/types";

/**
 * ルーティン1日分の所要時間を見積もる（分）。
 *
 * ジムの滞在時間には上限があるので、組んだメニューが現実的かを
 * その場で確かめられるようにする。内訳は次のとおり。
 *
 *   一般ウォームアップ          5 分（セッションに1回）
 *   種目のセッティング・移動    2 分 / 種目
 *   コンパウンドのアップセット  3 分 / 種目（軽い重量で2セット程度）
 *   ワークセット（挙上＋休憩）  コンパウンド 3.0 分 / 単関節 2.0 分
 *
 * ワークセットの内訳は、コンパウンドが挙上40秒＋休憩2分20秒、
 * 単関節が挙上30秒＋休憩90秒。筋肥大でよく使われる休憩時間に、
 * 器具待ちを見込んで少し多めに取っている。
 */
export const DURATION = {
  warmup: 5,
  setupPerExercise: 2,
  warmupSetsPerCompound: 3,
  minutesPerSet: { compound: 3.0, isolation: 2.0 },
  /** ジムの滞在時間の上限。テンプレはこの範囲に収める。 */
  sessionLimit: 90,
} as const;

export function estimateMinutes(
  items: { exerciseId: string; sets: number }[],
  exercises: Exercise[]
): number {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  let t = DURATION.warmup;
  for (const item of items) {
    const ex = byId.get(item.exerciseId);
    if (!ex) continue;
    t += DURATION.setupPerExercise;
    if (ex.compound) t += DURATION.warmupSetsPerCompound;
    t += item.sets * (ex.compound ? DURATION.minutesPerSet.compound : DURATION.minutesPerSet.isolation);
  }
  return Math.round(t);
}
