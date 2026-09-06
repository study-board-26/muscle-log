import type { RoutineRec } from "../db";

/**
 * FR-E2 テンプレプログラム
 *
 * 種目は Phase 1 の20種目から組んでいる。
 * セット数は、部位あたり週12〜20セット（ALG-6 の中級者レンジ）に
 * 収まることを目安に配分した。分割数が少ないほど1部位あたりの
 * 頻度が落ちるため、週3の全身法はレンジ下限寄りになる。
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
    id: "ppl6",
    name: "PPL（週6）",
    summary: "押す・引く・脚を2周。1部位を週2回叩けるので、ボリュームを最も稼ぎやすい。",
    build: () => ({
      id: "active",
      name: "PPL（週6）",
      days: [
        {
          dayOfWeek: 1,
          label: "押す A",
          items: [
            { exerciseId: "bench_press", sets: 4 },
            { exerciseId: "shoulder_press", sets: 3 },
            { exerciseId: "cable_lateral_raise", sets: 3 },
            { exerciseId: "cable_overhead_triceps_extension", sets: 3 },
          ],
        },
        {
          dayOfWeek: 2,
          label: "引く A",
          items: [
            { exerciseId: "lat_pulldown", sets: 4 },
            { exerciseId: "seated_cable_row", sets: 3 },
            { exerciseId: "reverse_pec_deck", sets: 3 },
            { exerciseId: "incline_dumbbell_curl", sets: 3 },
          ],
        },
        {
          dayOfWeek: 3,
          label: "脚 A",
          items: [
            { exerciseId: "barbell_squat", sets: 4 },
            { exerciseId: "seated_leg_curl", sets: 3 },
            { exerciseId: "standing_calf_raise", sets: 4 },
            { exerciseId: "cable_crunch", sets: 3 },
          ],
        },
        {
          dayOfWeek: 4,
          label: "押す B",
          items: [
            { exerciseId: "incline_press", sets: 4 },
            { exerciseId: "cable_fly", sets: 3 },
            { exerciseId: "close_grip_bench_press", sets: 3 },
            { exerciseId: "cable_lateral_raise", sets: 3 },
          ],
        },
        {
          dayOfWeek: 5,
          label: "引く B",
          items: [
            { exerciseId: "bent_over_row", sets: 4 },
            { exerciseId: "lat_pulldown", sets: 3 },
            { exerciseId: "reverse_pec_deck", sets: 3 },
            { exerciseId: "preacher_curl", sets: 3 },
          ],
        },
        {
          dayOfWeek: 6,
          label: "脚 B",
          items: [
            { exerciseId: "hip_thrust", sets: 4 },
            { exerciseId: "barbell_squat", sets: 3 },
            { exerciseId: "seated_leg_curl", sets: 3 },
            { exerciseId: "hanging_leg_raise", sets: 3 },
          ],
        },
      ],
    }),
  },
  {
    id: "upper_lower",
    name: "上下分割（週4）",
    summary: "上半身と下半身を2周。週6が組めない場合の現実的な選択肢。",
    build: () => ({
      id: "active",
      name: "上下分割（週4）",
      days: [
        {
          dayOfWeek: 1,
          label: "上半身 A",
          items: [
            { exerciseId: "bench_press", sets: 4 },
            { exerciseId: "lat_pulldown", sets: 4 },
            { exerciseId: "shoulder_press", sets: 3 },
            { exerciseId: "seated_cable_row", sets: 3 },
            { exerciseId: "incline_dumbbell_curl", sets: 3 },
            { exerciseId: "cable_overhead_triceps_extension", sets: 3 },
          ],
        },
        {
          dayOfWeek: 2,
          label: "下半身 A",
          items: [
            { exerciseId: "barbell_squat", sets: 4 },
            { exerciseId: "seated_leg_curl", sets: 4 },
            { exerciseId: "hip_thrust", sets: 3 },
            { exerciseId: "standing_calf_raise", sets: 4 },
          ],
        },
        {
          dayOfWeek: 4,
          label: "上半身 B",
          items: [
            { exerciseId: "incline_press", sets: 4 },
            { exerciseId: "bent_over_row", sets: 4 },
            { exerciseId: "cable_lateral_raise", sets: 4 },
            { exerciseId: "reverse_pec_deck", sets: 3 },
            { exerciseId: "preacher_curl", sets: 3 },
            { exerciseId: "close_grip_bench_press", sets: 3 },
          ],
        },
        {
          dayOfWeek: 5,
          label: "下半身 B",
          items: [
            { exerciseId: "hip_thrust", sets: 4 },
            { exerciseId: "barbell_squat", sets: 3 },
            { exerciseId: "seated_leg_curl", sets: 3 },
            { exerciseId: "standing_calf_raise", sets: 4 },
            { exerciseId: "hanging_leg_raise", sets: 3 },
          ],
        },
      ],
    }),
  },
  {
    id: "fullbody3",
    name: "全身（週3）",
    summary: "1回で全身を回す。時間が取れない時期でも頻度を落とさずに済む。",
    build: () => ({
      id: "active",
      name: "全身（週3）",
      days: [1, 3, 5].map((dow, i) => ({
        dayOfWeek: dow,
        label: `全身 ${"ABC"[i]}`,
        items: [
          { exerciseId: i === 1 ? "incline_press" : "bench_press", sets: 3 },
          { exerciseId: i === 1 ? "seated_cable_row" : "lat_pulldown", sets: 3 },
          { exerciseId: "barbell_squat", sets: 3 },
          { exerciseId: "seated_leg_curl", sets: 3 },
          { exerciseId: "cable_lateral_raise", sets: 3 },
          { exerciseId: i === 2 ? "hanging_leg_raise" : "cable_crunch", sets: 3 },
        ],
      })),
    }),
  },
];
