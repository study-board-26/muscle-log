import type { RoutineRec } from "../db";

/**
 * FR-E2 テンプレプログラム
 *
 * 種目は Phase 1 の20種目から組んでいる。
 *
 * セット配分の方針:
 *  - 上半身と下半身のセット比を約 2:1 にする
 *  - 部位あたり週12〜20セット（ALG-6 の中級者レンジ）を目安にする
 *
 * 比率は腹筋を除いて数える。腹筋はどちらにも属さず、
 * 上下のバランスの議論に入れると話がぼやけるため。
 * 実際の比率は npm test で検証している。
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
            { exerciseId: "seated_leg_curl", sets: 4 },
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
            { exerciseId: "barbell_squat", sets: 4 },
            { exerciseId: "seated_leg_curl", sets: 3 },
            { exerciseId: "standing_calf_raise", sets: 3 },
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
            { exerciseId: "seated_leg_curl", sets: 3 },
            { exerciseId: "standing_calf_raise", sets: 3 },
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
      days: [
        {
          dayOfWeek: 1,
          label: "全身 A",
          items: [
            { exerciseId: "bench_press", sets: 3 },
            { exerciseId: "lat_pulldown", sets: 3 },
            { exerciseId: "cable_lateral_raise", sets: 2 },
            { exerciseId: "incline_dumbbell_curl", sets: 2 },
            { exerciseId: "barbell_squat", sets: 3 },
            { exerciseId: "seated_leg_curl", sets: 2 },
            { exerciseId: "cable_crunch", sets: 2 },
          ],
        },
        {
          dayOfWeek: 3,
          label: "全身 B",
          items: [
            { exerciseId: "incline_press", sets: 3 },
            { exerciseId: "seated_cable_row", sets: 3 },
            { exerciseId: "shoulder_press", sets: 2 },
            { exerciseId: "cable_overhead_triceps_extension", sets: 2 },
            { exerciseId: "barbell_squat", sets: 3 },
            { exerciseId: "hip_thrust", sets: 2 },
            { exerciseId: "hanging_leg_raise", sets: 2 },
          ],
        },
        {
          dayOfWeek: 5,
          label: "全身 C",
          items: [
            { exerciseId: "bench_press", sets: 3 },
            { exerciseId: "bent_over_row", sets: 3 },
            { exerciseId: "cable_lateral_raise", sets: 2 },
            { exerciseId: "preacher_curl", sets: 2 },
            { exerciseId: "barbell_squat", sets: 3 },
            { exerciseId: "standing_calf_raise", sets: 2 },
            { exerciseId: "cable_crunch", sets: 2 },
          ],
        },
      ],
    }),
  },
];
