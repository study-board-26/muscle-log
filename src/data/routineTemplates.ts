import type { RoutineRec } from "../db";

/**
 * FR-E2 テンプレプログラム
 *
 * 設計の根拠（2026-09 改訂）:
 *
 *  1. 頻度: 1部位あたり週2回。週の総量を揃えた比較で、週1回より週2回以上が
 *     有利という結論が出ている（Schoenfeld 2016 のメタ分析）。
 *     このため既定を「上下分割の週4」とした。
 *
 *  2. 1回あたりの上限: 1筋群あたり 11 fractional セットを超えない。
 *     セット数と肥大の用量反応は逓減し、1セッションではこの付近で
 *     頭打ちになる（Remmert 2025）。これ以上は同じ週内で別の日に回す。
 *
 *  3. 週あたり: 主要筋群 10〜20、補助筋群 4〜12 セット（ALG-6）。
 *     ボリュームは ALG-2 と同じ按分で数える（prime 1.0 / secondary 0.5、
 *     1セットが1筋群に与える寄与は最大 1.0）。
 *
 *  4. 種目のばらつき: 同一筋群を角度の違う2種目で当てる。
 *     全体量が同じなら部位別の伸びに差が出るという報告があり、
 *     少なくとも不利にはならない。ただし種目を増やしすぎると
 *     1種目あたりの漸進性が追えなくなるため、上下分割は1日8種目までに
 *     抑える（全身は1回で全部位を回す都合で9種目まで）。
 *
 *  5. ケーブル種目: 胸・二頭・三頭には各日1〜2種目、肩にはケーブル・
 *     サイドレイズを必ず入れる（利用者の要望）。ケーブルとフリーウェイトの
 *     肥大効果に差は認められていないため、これは有効性を損なわない選択。
 *
 * セット比は腹筋を除いて上半身:下半身 ≒ 2:1。
 * 比率・上限・ケーブル要件はすべて npm test で検証している。
 */

export interface RoutineTemplate {
  id: string;
  name: string;
  summary: string;
  build: () => RoutineRec;
}

const D = ["日", "月", "火", "水", "木", "金", "土"];

export function dayLabel(dayOfWeek: number): string {
  return D[dayOfWeek];
}

export const TEMPLATES: RoutineTemplate[] = [
  {
    id: "upper_lower",
    name: "上下分割（週4）",
    summary:
      "推奨。全17筋群が週2回・週10〜20セットに収まる。1日8種目までで、胸・二頭・三頭にケーブル、肩にケーブルサイドレイズを配置。",
    build: () => ({
      id: "active",
      name: "上下分割（週4）",
      days: [
        {
          dayOfWeek: 1,
          label: "上半身 A",
          items: [
            { exerciseId: "bench_press", sets: 4 },
            { exerciseId: "cable_fly", sets: 3 },
            { exerciseId: "lat_pulldown", sets: 4 },
            { exerciseId: "seated_cable_row", sets: 3 },
            { exerciseId: "cable_lateral_raise", sets: 5 },
            { exerciseId: "cable_face_pull", sets: 3 },
            { exerciseId: "cable_overhead_triceps_extension", sets: 4 },
            { exerciseId: "bayesian_cable_curl", sets: 3 },
          ],
        },
        {
          dayOfWeek: 2,
          label: "下半身 A",
          items: [
            { exerciseId: "barbell_squat", sets: 4 },
            { exerciseId: "seated_leg_curl", sets: 4 },
            { exerciseId: "leg_press", sets: 4 },
            { exerciseId: "standing_calf_raise", sets: 4 },
            { exerciseId: "cable_crunch", sets: 5 },
          ],
        },
        {
          dayOfWeek: 4,
          label: "上半身 B",
          items: [
            { exerciseId: "incline_press", sets: 4 },
            { exerciseId: "cable_fly", sets: 3 },
            { exerciseId: "bent_over_row", sets: 4 },
            { exerciseId: "reverse_pec_deck", sets: 4 },
            { exerciseId: "cable_lateral_raise", sets: 5 },
            { exerciseId: "cable_pushdown", sets: 3 },
            { exerciseId: "bayesian_cable_curl", sets: 3 },
            { exerciseId: "hammer_curl", sets: 3 },
          ],
        },
        {
          dayOfWeek: 5,
          label: "下半身 B",
          items: [
            { exerciseId: "barbell_deadlift", sets: 3 },
            { exerciseId: "hip_thrust", sets: 4 },
            { exerciseId: "leg_extension", sets: 4 },
            { exerciseId: "standing_calf_raise", sets: 4 },
            { exerciseId: "hanging_leg_raise", sets: 5 },
          ],
        },
      ],
    }),
  },
  {
    id: "ppl6",
    name: "PPL（週6）",
    summary:
      "1日15〜21セットと軽く、種目を週に分散できる。全17筋群が週2回・レンジ内。ジムに行ける日数が多い時期向け。",
    build: () => ({
      id: "active",
      name: "PPL（週6）",
      days: [
        {
          dayOfWeek: 1,
          label: "押す A",
          items: [
            { exerciseId: "bench_press", sets: 4 },
            { exerciseId: "cable_fly", sets: 3 },
            { exerciseId: "cable_lateral_raise", sets: 5 },
            { exerciseId: "cable_overhead_triceps_extension", sets: 3 },
          ],
        },
        {
          dayOfWeek: 2,
          label: "引く A",
          items: [
            { exerciseId: "lat_pulldown", sets: 4 },
            { exerciseId: "seated_cable_row", sets: 3 },
            { exerciseId: "cable_face_pull", sets: 3 },
            { exerciseId: "bayesian_cable_curl", sets: 3 },
          ],
        },
        {
          dayOfWeek: 3,
          label: "脚 A",
          items: [
            { exerciseId: "barbell_squat", sets: 4 },
            { exerciseId: "seated_leg_curl", sets: 4 },
            { exerciseId: "leg_press", sets: 4 },
            { exerciseId: "standing_calf_raise", sets: 4 },
            { exerciseId: "cable_crunch", sets: 5 },
          ],
        },
        {
          dayOfWeek: 4,
          label: "押す B",
          items: [
            { exerciseId: "incline_press", sets: 4 },
            { exerciseId: "cable_fly", sets: 3 },
            { exerciseId: "cable_lateral_raise", sets: 5 },
            { exerciseId: "cable_pushdown", sets: 3 },
          ],
        },
        {
          dayOfWeek: 5,
          label: "引く B",
          items: [
            { exerciseId: "bent_over_row", sets: 4 },
            { exerciseId: "lat_pulldown", sets: 3 },
            { exerciseId: "reverse_pec_deck", sets: 4 },
            { exerciseId: "bayesian_cable_curl", sets: 3 },
            { exerciseId: "hammer_curl", sets: 3 },
          ],
        },
        {
          dayOfWeek: 6,
          label: "脚 B",
          items: [
            { exerciseId: "barbell_deadlift", sets: 3 },
            { exerciseId: "hip_thrust", sets: 5 },
            { exerciseId: "leg_extension", sets: 4 },
            { exerciseId: "standing_calf_raise", sets: 4 },
            { exerciseId: "hanging_leg_raise", sets: 5 },
          ],
        },
      ],
    }),
  },
  {
    id: "fullbody3",
    name: "全身（週3）",
    summary:
      "各部位を週3回叩ける代わりに1日30セット超と長い。週の日数が取れない時期向け。",
    build: () => ({
      id: "active",
      name: "全身（週3）",
      days: [
        {
          dayOfWeek: 1,
          label: "全身 A",
          items: [
            { exerciseId: "bench_press", sets: 3 },
            { exerciseId: "cable_fly", sets: 2 },
            { exerciseId: "lat_pulldown", sets: 5 },
            { exerciseId: "cable_lateral_raise", sets: 5 },
            { exerciseId: "bayesian_cable_curl", sets: 4 },
            { exerciseId: "cable_face_pull", sets: 3 },
            { exerciseId: "barbell_squat", sets: 4 },
            { exerciseId: "seated_leg_curl", sets: 5 },
            { exerciseId: "cable_crunch", sets: 4 },
          ],
        },
        {
          dayOfWeek: 3,
          label: "全身 B",
          items: [
            { exerciseId: "incline_press", sets: 3 },
            { exerciseId: "cable_fly", sets: 2 },
            { exerciseId: "seated_cable_row", sets: 6 },
            { exerciseId: "cable_lateral_raise", sets: 5 },
            { exerciseId: "cable_pushdown", sets: 3 },
            { exerciseId: "leg_press", sets: 5 },
            { exerciseId: "seated_leg_curl", sets: 3 },
            { exerciseId: "standing_calf_raise", sets: 4 },
            { exerciseId: "hanging_leg_raise", sets: 3 },
          ],
        },
        {
          dayOfWeek: 5,
          label: "全身 C",
          items: [
            { exerciseId: "bench_press", sets: 3 },
            { exerciseId: "cable_fly", sets: 2 },
            { exerciseId: "barbell_deadlift", sets: 4 },
            { exerciseId: "reverse_pec_deck", sets: 6 },
            { exerciseId: "cable_overhead_triceps_extension", sets: 3 },
            { exerciseId: "hammer_curl", sets: 4 },
            { exerciseId: "hip_thrust", sets: 4 },
            { exerciseId: "standing_calf_raise", sets: 4 },
            { exerciseId: "cable_crunch", sets: 3 },
          ],
        },
      ],
    }),
  },
];
