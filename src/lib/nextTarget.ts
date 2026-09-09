import type { Exercise, Muscle, Region } from "../data/types";
import type { SetLogRec } from "../db";
import {
  rangeFor,
  trainedGroups,
  type ExperienceKey,
  type MuscleGroupDef,
} from "./volume.ts";

/**
 * ALG-9 次に鍛える部位の提案（FR-D5）
 *
 * 「今週どこが足りていないか」と「どこをしばらく触っていないか」の2つから、
 * 次のセッションで優先したい部位を2〜3つ選ぶ。
 *
 * 集計の窓は直近7日で、カレンダー週ではない。週の判定（FR-C4）は月曜起点
 * だが、それをこの提案に使うと月曜の朝は全筋群がほぼ0セットになり、
 * 「全部足りていない」としか言えなくなる。直近7日なら曜日に関係なく
 * 同じ意味の数字が出る。
 *
 * 除外するのは直近2日以内に鍛えた筋群。同じ筋を続けて叩くのは
 * 回復の面で不利なので、提案としては出さない。
 *
 * これは目安であって処方ではない。根拠は ALG-6 のレンジと、
 * 1部位あたり週2回という頻度の目安の2つだけで、種目の相性や
 * 疲労の実感は入っていない。
 */

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 直近2日以内に鍛えた筋群は提案しない */
const RECOVERY_DAYS = 2;

/** 何日空いたら「間隔として十分に空いた」とみなすか。週2回＝中3〜4日 */
const STALE_DAYS = 4;

/** 不足と間隔の重み。不足の方を重く見る */
const W_DEFICIT = 0.6;
const W_RECENCY = 0.4;

/**
 * 補助的な筋群（脊柱起立筋・内転筋群・前腕・腹斜筋）の重み。
 * 多関節種目で間接的に入るため、狙って足しにいく必要が薄い。
 */
const SUPPORTING_WEIGHT = 0.5;

export interface RegionSuggestion {
  region: Region;
  score: number;
  /** その部位でいちばん遅れている筋群。畳んだ状態の一言に使う */
  lead: string;
  /** 提案の理由。優先度を決めた筋群の状況を1〜2行で示す */
  reasons: string[];
}

interface GroupState {
  group: string;
  region: Region;
  sets: number;
  lo: number;
  daysSince: number | null;
  score: number;
}

/**
 * 「何日空いたか」は暦日の差で数える。
 * 経過ミリ秒を切り捨てると、3日前の夕方にやった記録が「2日」になる。
 * 利用者が数えるのは日付の差なので、そちらに合わせる。
 */
function daysBetween(a: number, b: number): number {
  const d0 = new Date(b);
  d0.setHours(0, 0, 0, 0);
  const d1 = new Date(a);
  d1.setHours(0, 0, 0, 0);
  return Math.round((d1.getTime() - d0.getTime()) / DAY_MS);
}

/**
 * 直近7日のセットから、次に鍛えたい部位を優先度順に返す。
 * 記録が無い場合は空配列。呼び出し側は、空なら提案を出さない。
 */
export function suggestNextRegions(
  allSets: SetLogRec[],
  exercises: Exercise[],
  muscles: Muscle[],
  groups: MuscleGroupDef[],
  experience: ExperienceKey,
  now = Date.now(),
  limit = 3
): RegionSuggestion[] {
  const mains = allSets.filter((s) => s.type === "main");
  if (mains.length === 0) return [];

  const since = now - WINDOW_DAYS * DAY_MS;
  const window = mains.filter((s) => s.loggedAt >= since);

  const volume = new Map(
    trainedGroups(window, exercises, muscles).map((g) => [g.group, g.sets])
  );

  // 筋群ごとの最終実施日。窓の外まで遡って見る（14日空いていることもある）
  const lastAt = new Map<string, number>();
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const muById = new Map(muscles.map((m) => [m.id, m]));
  for (const s of mains) {
    const ex = exById.get(s.exerciseId);
    if (!ex) continue;
    for (const em of ex.muscles) {
      if (em.coefficient <= 0) continue;
      const g = muById.get(em.muscleId)?.group;
      if (!g) continue;
      lastAt.set(g, Math.max(lastAt.get(g) ?? 0, s.loggedAt));
    }
  }

  const regionOf = new Map<string, Region>();
  for (const m of muscles) {
    if (m.group && !regionOf.has(m.group)) regionOf.set(m.group, m.region);
  }

  const states: GroupState[] = [];
  for (const def of groups) {
    const region = regionOf.get(def.name);
    if (!region) continue;

    const sets = volume.get(def.name) ?? 0;
    const [lo] = rangeFor(def.tier, experience);
    const last = lastAt.get(def.name);
    const daysSince = last === undefined ? null : daysBetween(now, last);

    // 回復を待っている筋群は候補から外す
    if (daysSince !== null && daysSince < RECOVERY_DAYS) continue;

    // 0..1。レンジ下限にどれだけ届いていないか
    const deficit = lo > 0 ? Math.max(0, lo - sets) / lo : 0;
    // 0..1。一度も記録が無い場合は最大に振る
    const recency =
      daysSince === null ? 1 : Math.min(daysSince, STALE_DAYS) / STALE_DAYS;

    let score = deficit * W_DEFICIT + recency * W_RECENCY;
    if (def.tier === "supporting") score *= SUPPORTING_WEIGHT;

    states.push({ group: def.name, region, sets, lo, daysSince, score });
  }

  // 部位の優先度は、その部位でいちばん遅れている筋群で決める。
  // 平均にすると、肩のように筋群を多く含む部位で「後部だけ遅れている」が薄まる。
  const byRegion = new Map<Region, GroupState[]>();
  for (const st of states) {
    const list = byRegion.get(st.region) ?? [];
    list.push(st);
    byRegion.set(st.region, list);
  }

  const out: RegionSuggestion[] = [];
  for (const [region, list] of byRegion) {
    list.sort((a, b) => b.score - a.score);
    const top = list[0];
    // 足りていて、間隔も空いていない部位は挙げない
    if (top.score <= 0) continue;
    out.push({ region, score: top.score, lead: top.group, reasons: list.slice(0, 2).map(describe) });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

function describe(st: GroupState): string {
  const sets = Math.round(st.sets * 10) / 10;
  if (st.daysSince === null) return `${st.group}：まだ記録がありません`;
  if (sets < st.lo) {
    return `${st.group}：直近7日で ${sets} セット（目安 ${st.lo} 以上）・${st.daysSince}日空いています`;
  }
  return `${st.group}：${st.daysSince}日空いています`;
}
