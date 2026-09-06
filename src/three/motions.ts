import type { JointName } from "./figure.ts";

/**
 * 種目ごとの動作。
 *
 * 各関節の回転角（ラジアン）を「開始姿勢」と「終了姿勢」で持ち、
 * 間を補間して往復させる。多くの種目は2姿勢で意図が伝わるため、
 * キーフレームは最小限にしてある。
 *
 * 回転の向き（この骨格での定義）:
 *   肩 x 負 = 腕を前へ / 肩 z 正 = 左腕を外へ開く（右は符号反転）
 *   肘 x 負 = 曲げる
 *   股 x 負 = 腿を前へ / 膝 x 正 = すねを後ろへ折る
 *   足首 x 正 = つま先を下げる
 */

export type Pose = Partial<Record<JointName, [number, number, number]>>;

export interface Motion {
  /** 体全体の向きと高さ。仰向けや座位を表す */
  rootRotation?: [number, number, number];
  rootPosition?: [number, number, number];
  start: Pose;
  end: Pose;
  /** 1往復の秒数 */
  period: number;
  /** カメラの初期方位角（ラジアン）。正面が見づらい種目で使う */
  view?: number;
}

/** 左右対称に肩を開く。L は正、R は負 */
const armsSpread = (z: number, x = 0): Pose => ({
  shoulderL: [x, 0, z],
  shoulderR: [x, 0, -z],
});

const elbows = (x: number): Pose => ({ elbowL: [x, 0, 0], elbowR: [x, 0, 0] });

const merge = (...poses: Pose[]): Pose => Object.assign({}, ...poses);

const SEATED: Pose = {
  hipL: [-1.5, 0, 0],
  hipR: [-1.5, 0, 0],
  kneeL: [1.5, 0, 0],
  kneeR: [1.5, 0, 0],
};

export const MOTIONS: Record<string, Motion> = {
  /* ---- 胸 ---- */
  bench_press: {
    rootRotation: [-Math.PI / 2, 0, 0],
    rootPosition: [0, 0.55, 0],
    period: 3.0,
    view: 0.9,
    start: merge(armsSpread(0.55, -1.35), elbows(-1.95)),
    end: merge(armsSpread(0.30, -1.5), elbows(-0.12)),
  },
  incline_press: {
    rootRotation: [-1.1, 0, 0],
    rootPosition: [0, 0.62, 0],
    period: 3.0,
    view: 0.9,
    start: merge(armsSpread(0.6, -1.25), elbows(-1.9), SEATED),
    end: merge(armsSpread(0.35, -1.45), elbows(-0.12), SEATED),
  },
  cable_fly: {
    period: 3.2,
    start: merge(armsSpread(1.45, -0.15), elbows(-0.35)),
    end: merge(armsSpread(0.18, -1.5), elbows(-0.35)),
  },
  chest_dip: {
    period: 3.0,
    view: 0.9,
    start: merge(armsSpread(0.22, 0.25), elbows(-1.9), { spine: [-0.3, 0, 0], hipL: [-0.5, 0, 0], hipR: [-0.5, 0, 0], kneeL: [1.2, 0, 0], kneeR: [1.2, 0, 0] }),
    end: merge(armsSpread(0.12, 0.05), elbows(-0.1), { spine: [-0.25, 0, 0], hipL: [-0.5, 0, 0], hipR: [-0.5, 0, 0], kneeL: [1.2, 0, 0], kneeR: [1.2, 0, 0] }),
  },

  /* ---- 肩 ---- */
  shoulder_press: {
    period: 2.8,
    start: merge(armsSpread(1.3, -0.15), elbows(-1.75)),
    end: merge(armsSpread(2.55, -0.05), elbows(-0.12)),
  },
  cable_lateral_raise: {
    period: 2.8,
    start: merge(armsSpread(0.06), elbows(-0.22)),
    end: merge(armsSpread(1.5), elbows(-0.25)),
  },
  reverse_pec_deck: {
    period: 3.0,
    view: 2.4,
    start: merge(armsSpread(0.25, -1.5), elbows(-0.5), { spine: [-0.5, 0, 0] }),
    end: merge(armsSpread(1.45, -0.55), elbows(-0.5), { spine: [-0.5, 0, 0] }),
  },
  cable_face_pull: {
    period: 3.0,
    start: merge(armsSpread(0.5, -1.45), elbows(-0.35)),
    end: merge(armsSpread(1.5, -0.9), elbows(-1.9)),
  },

  /* ---- 背中 ---- */
  lat_pulldown: {
    period: 3.0,
    start: merge(armsSpread(2.5, -0.1), elbows(-0.15), SEATED),
    end: merge(armsSpread(1.15, -0.1), elbows(-2.0), SEATED),
  },
  seated_cable_row: {
    period: 3.0,
    view: 1.3,
    start: merge(armsSpread(0.2, -1.5), elbows(-0.2), SEATED, { spine: [-0.25, 0, 0] }),
    end: merge(armsSpread(0.12, -0.35), elbows(-2.1), SEATED, { spine: [0.12, 0, 0] }),
  },
  bent_over_row: {
    period: 3.0,
    view: 1.3,
    start: merge(armsSpread(0.16, -0.9), elbows(-0.15), { spine: [-0.95, 0, 0], hipL: [-0.15, 0, 0], hipR: [-0.15, 0, 0], kneeL: [0.35, 0, 0], kneeR: [0.35, 0, 0] }),
    end: merge(armsSpread(0.12, -0.2), elbows(-2.0), { spine: [-0.95, 0, 0], hipL: [-0.15, 0, 0], hipR: [-0.15, 0, 0], kneeL: [0.35, 0, 0], kneeR: [0.35, 0, 0] }),
  },
  straight_arm_pulldown: {
    period: 3.0,
    view: 1.3,
    start: merge(armsSpread(0.2, -1.5), elbows(-0.2), { spine: [-0.4, 0, 0] }),
    end: merge(armsSpread(0.16, -0.05), elbows(-0.2), { spine: [-0.4, 0, 0] }),
  },

  /* ---- 腕 ---- */
  incline_dumbbell_curl: {
    rootRotation: [-0.85, 0, 0],
    rootPosition: [0, 0.66, 0],
    period: 2.8,
    view: 1.1,
    start: merge(armsSpread(0.12, 0.45), elbows(-0.12), SEATED),
    end: merge(armsSpread(0.12, 0.45), elbows(-2.5), SEATED),
  },
  preacher_curl: {
    period: 2.8,
    view: 1.1,
    start: merge(armsSpread(0.14, -0.95), elbows(-0.25), SEATED),
    end: merge(armsSpread(0.14, -0.95), elbows(-2.4), SEATED),
  },
  ez_bar_curl: {
    period: 2.6,
    view: 1.1,
    start: merge(armsSpread(0.1, 0.05), elbows(-0.15)),
    end: merge(armsSpread(0.1, -0.25), elbows(-2.4)),
  },
  bayesian_cable_curl: {
    period: 2.8,
    view: 1.1,
    start: merge(armsSpread(0.12, 0.55), elbows(-0.12)),
    end: merge(armsSpread(0.12, 0.55), elbows(-2.45)),
  },
  cable_overhead_triceps_extension: {
    period: 2.8,
    view: 1.1,
    start: merge(armsSpread(2.55, -0.1), elbows(-2.45)),
    end: merge(armsSpread(2.55, -0.1), elbows(-0.1)),
  },
  close_grip_bench_press: {
    rootRotation: [-Math.PI / 2, 0, 0],
    rootPosition: [0, 0.55, 0],
    period: 3.0,
    view: 0.9,
    start: merge(armsSpread(0.2, -1.45), elbows(-1.95)),
    end: merge(armsSpread(0.14, -1.5), elbows(-0.12)),
  },
  lying_triceps_extension: {
    rootRotation: [-Math.PI / 2, 0, 0],
    rootPosition: [0, 0.55, 0],
    period: 2.8,
    view: 0.9,
    start: merge(armsSpread(0.16, -1.5), elbows(-2.4)),
    end: merge(armsSpread(0.16, -1.5), elbows(-0.12)),
  },
  cable_pushdown: {
    period: 2.6,
    view: 1.1,
    start: merge(armsSpread(0.12, -0.35), elbows(-1.9)),
    end: merge(armsSpread(0.12, -0.1), elbows(-0.1)),
  },
  reverse_curl: {
    period: 2.6,
    view: 1.1,
    start: merge(armsSpread(0.1, 0.05), elbows(-0.15)),
    end: merge(armsSpread(0.1, -0.25), elbows(-2.3)),
  },
  hammer_curl: {
    period: 2.6,
    view: 1.1,
    start: merge(armsSpread(0.12, 0.05), elbows(-0.15)),
    end: merge(armsSpread(0.12, -0.2), elbows(-2.35)),
  },
  wrist_curl: {
    period: 2.2,
    view: 1.1,
    start: merge(armsSpread(0.14, -1.1), elbows(-1.5), { wristL: [0.5, 0, 0], wristR: [0.5, 0, 0] }, SEATED),
    end: merge(armsSpread(0.14, -1.1), elbows(-1.5), { wristL: [-0.6, 0, 0], wristR: [-0.6, 0, 0] }, SEATED),
  },
  heavy_hold: {
    period: 4.0,
    start: merge(armsSpread(0.08), elbows(-0.08)),
    end: merge(armsSpread(0.1), elbows(-0.12)),
  },

  /* ---- 腹 ---- */
  cable_crunch: {
    period: 2.8,
    view: 1.2,
    start: merge(armsSpread(0.2, -2.3), elbows(-1.5), { spine: [0.1, 0, 0], hipL: [-1.6, 0, 0], hipR: [-1.6, 0, 0], kneeL: [1.7, 0, 0], kneeR: [1.7, 0, 0] }),
    end: merge(armsSpread(0.2, -2.1), elbows(-1.5), { spine: [-0.9, 0, 0], chest: [-0.35, 0, 0], hipL: [-1.6, 0, 0], hipR: [-1.6, 0, 0], kneeL: [1.7, 0, 0], kneeR: [1.7, 0, 0] }),
  },
  hanging_leg_raise: {
    period: 3.2,
    view: 1.2,
    start: merge(armsSpread(0.12, 0), { shoulderL: [0, 0, 2.9], shoulderR: [0, 0, -2.9] }, elbows(-0.1)),
    end: merge({ shoulderL: [0, 0, 2.9], shoulderR: [0, 0, -2.9] }, elbows(-0.1), {
      hipL: [-1.8, 0, 0], hipR: [-1.8, 0, 0], kneeL: [0.5, 0, 0], kneeR: [0.5, 0, 0], spine: [-0.25, 0, 0],
    }),
  },
  ab_rollout: {
    period: 3.4,
    view: 1.2,
    start: merge(armsSpread(0.15, -2.8), elbows(-0.1), { spine: [0.15, 0, 0], hipL: [-1.4, 0, 0], hipR: [-1.4, 0, 0], kneeL: [1.9, 0, 0], kneeR: [1.9, 0, 0] }),
    end: merge(armsSpread(0.15, -1.6), elbows(-0.1), { spine: [-0.55, 0, 0], hipL: [-1.9, 0, 0], hipR: [-1.9, 0, 0], kneeL: [1.9, 0, 0], kneeR: [1.9, 0, 0] }),
  },
  cable_woodchop: {
    period: 3.0,
    start: merge({ shoulderL: [-1.2, 0, 1.7], shoulderR: [-1.2, 0, -1.2] }, elbows(-0.3), { spine: [0, 0.5, 0.2] }),
    end: merge({ shoulderL: [-0.4, 0, 0.3], shoulderR: [-0.4, 0, -0.1] }, elbows(-0.3), { spine: [0, -0.5, -0.2] }),
  },

  /* ---- 脚 ---- */
  barbell_squat: {
    period: 3.4,
    view: 1.2,
    start: merge(armsSpread(1.5, 0.2), elbows(-2.1)),
    end: merge(armsSpread(1.5, 0.2), elbows(-2.1), {
      hipL: [-1.55, 0, 0], hipR: [-1.55, 0, 0],
      kneeL: [1.75, 0, 0], kneeR: [1.75, 0, 0],
      ankleL: [-0.35, 0, 0], ankleR: [-0.35, 0, 0],
      spine: [-0.38, 0, 0], chest: [-0.12, 0, 0],
    }),
  },
  seated_leg_curl: {
    rootRotation: [-0.35, 0, 0],
    period: 3.0,
    view: 1.3,
    start: merge(SEATED, armsSpread(0.14, -0.5), elbows(-0.6), { kneeL: [0.25, 0, 0], kneeR: [0.25, 0, 0] }),
    end: merge(SEATED, armsSpread(0.14, -0.5), elbows(-0.6), { kneeL: [1.85, 0, 0], kneeR: [1.85, 0, 0] }),
  },
  hip_thrust: {
    period: 3.0,
    view: 1.3,
    rootPosition: [0, 0.55, 0],
    start: merge(armsSpread(0.2, -0.6), elbows(-0.4), {
      spine: [-0.9, 0, 0], hipL: [-1.5, 0, 0], hipR: [-1.5, 0, 0],
      kneeL: [1.5, 0, 0], kneeR: [1.5, 0, 0],
    }),
    end: merge(armsSpread(0.2, -0.6), elbows(-0.4), {
      spine: [-0.35, 0, 0], hipL: [-0.35, 0, 0], hipR: [-0.35, 0, 0],
      kneeL: [1.5, 0, 0], kneeR: [1.5, 0, 0],
    }),
  },
  standing_calf_raise: {
    period: 2.4,
    view: 1.3,
    start: merge(armsSpread(0.08), elbows(-0.1), { ankleL: [0, 0, 0], ankleR: [0, 0, 0] }),
    end: merge(armsSpread(0.08), elbows(-0.1), { ankleL: [0.62, 0, 0], ankleR: [0.62, 0, 0] }),
  },
};

/** 動作が未定義の種目に使う立ち姿勢 */
export const IDLE: Motion = {
  period: 4,
  start: merge(armsSpread(0.09), elbows(-0.12)),
  end: merge(armsSpread(0.13), elbows(-0.18)),
};

export function motionFor(exerciseId: string): { motion: Motion; defined: boolean } {
  const m = MOTIONS[exerciseId];
  return m ? { motion: m, defined: true } : { motion: IDLE, defined: false };
}
