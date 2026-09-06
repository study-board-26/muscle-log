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

export interface GroupVolume {
  group: string;
  region: Region;
  sets: number;
  status: VolumeStatus;
  range: [number, number];
}

/**
 * ALG-6 週間ボリュームの目安レンジ
 *
 * 単位は「筋群あたり」。文献の 10〜20セット/週 はもともと筋群あたりの
 * 数字であり、部位あたりで判定すると、含む筋群の数が多い部位ほど
 * 過多と誤判定される。実際に「肩」は3頭、「足」は4筋群を含むため、
 * 一律のレンジでは推奨テンプレートまで過多と出ていた。
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
 * 指定した期間のセットから、筋群別のボリュームを集計する。
 *
 * 1セットが1つの筋群に与える寄与は最大1.0までとする。
 * 例えばベンチプレスは上腕三頭筋の外側頭・内側頭を協働筋に持つが、
 * 合計すると 0.5 + 0.5 = 1.0 となり、協働なのに主働と同じ量が入ってしまう。
 * 要件の例（ベンチ4セット → 胸4.0 / 肩2.0 / 三頭2.0）に一致させる。
 */
export function aggregateVolume(
  sets: SetLogRec[],
  exercises: Exercise[],
  muscles: Muscle[],
  range: [number, number]
): GroupVolume[] {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const muById = new Map(muscles.map((m) => [m.id, m]));

  const totals = new Map<string, number>();

  for (const s of sets) {
    if (s.type !== "main") continue;
    const ex = exById.get(s.exerciseId);
    if (!ex) continue;

    const perGroup = new Map<string, number>();
    for (const em of ex.muscles) {
      const mu = muById.get(em.muscleId);
      if (!mu?.group) continue;
      if (em.coefficient <= 0) continue;
      perGroup.set(mu.group, Math.max(perGroup.get(mu.group) ?? 0, em.coefficient));
    }
    for (const [group, c] of perGroup) {
      totals.set(group, (totals.get(group) ?? 0) + c);
    }
  }

  // 部位の並び順を保ったまま、その部位に属する筋群を列挙する
  const seen = new Set<string>();
  const out: GroupVolume[] = [];
  for (const m of muscles) {
    if (!m.group || seen.has(m.group)) continue;
    seen.add(m.group);
    const total = totals.get(m.group) ?? 0;
    out.push({
      group: m.group,
      region: m.region,
      sets: Math.round(total * 10) / 10,
      status: judge(total, range),
      range,
    });
  }
  return out;
}

/** 記録のある週を新しい順に返す */
export function weeksWithData(sets: SetLogRec[]): number[] {
  const set = new Set(sets.filter((s) => s.type === "main").map((s) => weekStart(s.loggedAt)));
  return [...set].sort((a, b) => b - a);
}
