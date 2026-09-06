import type { Exercise, Muscle, Region } from "../data/types";
import type { SetLogRec } from "../db";

/**
 * ALG-2 部位別ボリューム按分
 *
 *   prime      → 1.0 セット
 *   secondary  → 0.5 セット
 *   stabilizer → 0.0 セット（集計対象外）
 *
 * ウォームアップは集計しない。週の区切りは月曜0時起点。
 *
 * 部位への集計は「合計」ではなく「その部位に属する筋の最大係数」を取る。
 * 例えばベンチプレスは上腕三頭筋の外側頭・内側頭の2つを協働筋として持つが、
 * 合計すると 0.5 + 0.5 = 1.0 となり、1セットで三頭に主働筋ぶんの
 * ボリュームが入ってしまう。要件の例（ベンチ4セット → 三頭 2.0）に合わせ、
 * 1セットが1部位に与える寄与は最大1.0までとする。
 */

export const DEFAULT_COEFFICIENT = {
  prime: 1.0,
  secondary: 0.5,
  stabilizer: 0.0,
} as const;

/** 月曜0時起点の週の開始時刻 */
export function weekStart(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0=日曜。月曜起点にするため日曜は6日戻す
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d.getTime();
}

export function weekLabel(start: number): string {
  const a = new Date(start);
  const b = new Date(start + 6 * 86400000);
  return `${a.getMonth() + 1}/${a.getDate()} 〜 ${b.getMonth() + 1}/${b.getDate()}`;
}

export type VolumeStatus = "low" | "ok" | "high";

export interface RegionVolume {
  region: Region;
  sets: number;
  status: VolumeStatus;
  range: [number, number];
  /** 内訳。筋ごとの按分値（部位合計とは一致しない） */
  byMuscle: { muscleId: string; nameJa: string; sets: number }[];
}

/**
 * ALG-6 週間ボリュームの目安レンジ（部位あたりのセット数）
 */
export const WEEKLY_RANGE = {
  beginner: [8, 12] as [number, number],
  intermediate: [12, 20] as [number, number],
  advanced: [12, 20] as [number, number],
};

export function judge(sets: number, range: [number, number]): VolumeStatus {
  if (sets < range[0]) return "low";
  if (sets > range[1]) return "high";
  return "ok";
}

export const STATUS_LABEL: Record<VolumeStatus, string> = {
  low: "不足",
  ok: "適正",
  high: "過多",
};

/**
 * 指定した期間のセットから、部位別・筋別のボリュームを集計する。
 */
export function aggregateVolume(
  sets: SetLogRec[],
  exercises: Exercise[],
  muscles: Muscle[],
  range: [number, number]
): RegionVolume[] {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const muById = new Map(muscles.map((m) => [m.id, m]));

  const regionTotals = new Map<Region, number>();
  const muscleTotals = new Map<string, number>();

  for (const s of sets) {
    if (s.type !== "main") continue;
    const ex = exById.get(s.exerciseId);
    if (!ex) continue;

    // 部位ごとに、その種目が持つ筋の最大係数を求める
    const perRegion = new Map<Region, number>();
    for (const em of ex.muscles) {
      const mu = muById.get(em.muscleId);
      if (!mu) continue;
      const c = em.coefficient;
      if (c <= 0) continue;

      muscleTotals.set(em.muscleId, (muscleTotals.get(em.muscleId) ?? 0) + c);
      perRegion.set(mu.region, Math.max(perRegion.get(mu.region) ?? 0, c));
    }
    for (const [region, c] of perRegion) {
      regionTotals.set(region, (regionTotals.get(region) ?? 0) + c);
    }
  }

  const out: RegionVolume[] = [];
  for (const region of new Set(muscles.map((m) => m.region))) {
    const total = regionTotals.get(region) ?? 0;
    const byMuscle = muscles
      .filter((m) => m.region === region && (muscleTotals.get(m.id) ?? 0) > 0)
      .map((m) => ({
        muscleId: m.id,
        nameJa: m.nameJa,
        sets: Math.round((muscleTotals.get(m.id) ?? 0) * 10) / 10,
      }))
      .sort((a, b) => b.sets - a.sets);

    out.push({
      region,
      sets: Math.round(total * 10) / 10,
      status: judge(total, range),
      range,
      byMuscle,
    });
  }
  return out;
}

/** 記録のある週を新しい順に返す */
export function weeksWithData(sets: SetLogRec[]): number[] {
  const set = new Set(sets.filter((s) => s.type === "main").map((s) => weekStart(s.loggedAt)));
  return [...set].sort((a, b) => b - a);
}
