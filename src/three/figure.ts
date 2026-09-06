import * as THREE from "three";

/**
 * 人体モデルをコードで組み立てる。
 *
 * 外部の3Dアセットを買わずに済ませるための方針（OPEN-2 / RISK-1）。
 * リアルな人体は作れないが、目的は「どの筋にどう効くか」の理解なので、
 * 部位の区別が明確な図解的モデルのほうがむしろ読み取りやすい。
 *
 * 骨格は親子関係を持つ Object3D の階層で、関節を回すと子がついてくる。
 * 筋肉はその骨格に貼り付けたメッシュで、name に muscles.json の
 * meshNodeId をそのまま入れてある。色分けとヒートマップはこの name で引く。
 */

/** 関節。ここを回して動作を作る */
export type JointName =
  | "pelvis" | "spine" | "chest" | "neck"
  | "shoulderL" | "shoulderR"
  | "elbowL" | "elbowR"
  | "wristL" | "wristR"
  | "hipL" | "hipR"
  | "kneeL" | "kneeR"
  | "ankleL" | "ankleR";

export interface Figure {
  root: THREE.Group;
  joints: Record<JointName, THREE.Object3D>;
  /** meshNodeId → その筋を構成するメッシュ（左右で2つになる） */
  muscles: Map<string, THREE.Mesh[]>;
  dispose: () => void;
}

const SKIN = 0x39434c;
const BONEISH = 0x2b333a;

/**
 * 筋腹の形。両端が細く中央が膨らむ紡錘形を旋盤で作る。
 * カプセルより筋肉らしく見え、頂点数も少ない。
 */
function bellyGeometry(length: number, girth: number, segments = 10): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // sin で中央が最も太くなる。端は完全に閉じる
    const r = Math.sin(Math.PI * t) ** 0.7 * girth;
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), (t - 0.5) * length));
  }
  return new THREE.LatheGeometry(pts, 12);
}

function limbGeometry(length: number, r1: number, r2: number): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(r2, r1, length, 10, 1, false);
}

export function buildFigure(): Figure {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const muscles = new Map<string, THREE.Mesh[]>();

  const skinMat = new THREE.MeshStandardMaterial({
    color: SKIN,
    roughness: 0.85,
    metalness: 0.0,
  });
  materials.push(skinMat);

  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  /** 筋肉メッシュを作って登録する。個別に色を変えるのでマテリアルは複製する */
  function muscle(
    meshNodeId: string,
    geo: THREE.BufferGeometry,
    parent: THREE.Object3D,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1]
  ): THREE.Mesh {
    const mat = new THREE.MeshStandardMaterial({
      color: SKIN,
      roughness: 0.6,
      metalness: 0.0,
    });
    materials.push(mat);
    const mesh = new THREE.Mesh(track(geo), mat);
    mesh.name = meshNodeId;
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.scale.set(...scale);
    parent.add(mesh);
    const list = muscles.get(meshNodeId) ?? [];
    list.push(mesh);
    muscles.set(meshNodeId, list);
    return mesh;
  }

  function bone(
    parent: THREE.Object3D,
    pos: [number, number, number],
    geo?: THREE.BufferGeometry,
    geoOffset: [number, number, number] = [0, 0, 0]
  ): THREE.Group {
    const g = new THREE.Group();
    g.position.set(...pos);
    parent.add(g);
    if (geo) {
      const m = new THREE.Mesh(track(geo), skinMat);
      m.position.set(...geoOffset);
      g.add(m);
    }
    return g;
  }

  // ---- 体幹 ----
  const pelvis = bone(root, [0, 0.98, 0], limbGeometry(0.20, 0.115, 0.10), [0, 0.02, 0]);
  const spine = bone(pelvis, [0, 0.12, 0], limbGeometry(0.16, 0.10, 0.115), [0, 0.08, 0]);
  const chest = bone(spine, [0, 0.17, 0], limbGeometry(0.20, 0.115, 0.135), [0, 0.09, 0]);
  const neck = bone(chest, [0, 0.20, 0], limbGeometry(0.08, 0.045, 0.045), [0, 0.04, 0]);
  const head = bone(neck, [0, 0.08, 0]);
  const headMesh = new THREE.Mesh(track(new THREE.SphereGeometry(0.095, 16, 12)), skinMat);
  headMesh.scale.set(0.9, 1.1, 1);
  headMesh.position.y = 0.07;
  head.add(headMesh);

  // 大胸筋：鎖骨部（上）と胸肋部（下）を分ける
  for (const side of [-1, 1]) {
    muscle("M_pec_clavicular", bellyGeometry(0.13, 0.052), chest,
      [side * 0.055, 0.145, 0.085], [Math.PI / 2, 0, side * 0.5], [1, 1, 0.55]);
    muscle("M_pec_sternal", bellyGeometry(0.16, 0.062), chest,
      [side * 0.06, 0.075, 0.082], [Math.PI / 2, 0, side * 0.28], [1, 1, 0.6]);
  }

  // 広背筋・大円筋・僧帽筋・菱形筋・脊柱起立筋
  for (const side of [-1, 1]) {
    muscle("M_latissimus_dorsi", bellyGeometry(0.26, 0.075), chest,
      [side * 0.075, 0.03, -0.06], [Math.PI / 2, 0, side * 0.18], [1, 1, 0.45]);
    muscle("M_teres_major", bellyGeometry(0.10, 0.032), chest,
      [side * 0.105, 0.15, -0.05], [Math.PI / 2, 0, side * 0.9]);
    muscle("M_trapezius_upper", bellyGeometry(0.16, 0.045), chest,
      [side * 0.07, 0.20, -0.03], [Math.PI / 2, 0, side * 1.15], [1, 1, 0.7]);
    muscle("M_trapezius_middle", bellyGeometry(0.13, 0.045), chest,
      [side * 0.055, 0.13, -0.075], [Math.PI / 2, 0, side * 0.35], [1, 1, 0.5]);
    muscle("M_trapezius_lower", bellyGeometry(0.15, 0.04), chest,
      [side * 0.04, 0.03, -0.075], [Math.PI / 2, 0, side * 0.18], [1, 1, 0.5]);
    muscle("M_rhomboids", bellyGeometry(0.10, 0.032), chest,
      [side * 0.045, 0.135, -0.085], [Math.PI / 2, 0, side * 0.6], [1, 1, 0.5]);
    muscle("M_erector_spinae", bellyGeometry(0.34, 0.035), spine,
      [side * 0.032, 0.10, -0.075], [0, 0, 0], [1, 1, 0.8]);
    muscle("M_rotator_cuff", bellyGeometry(0.09, 0.028), chest,
      [side * 0.10, 0.175, -0.045], [Math.PI / 2, 0, side * 0.7]);
  }

  // 腹部
  muscle("M_rectus_abdominis_upper", bellyGeometry(0.13, 0.055), spine,
    [0, 0.10, 0.085], [0, 0, 0], [1.25, 1, 0.5]);
  muscle("M_rectus_abdominis_lower", bellyGeometry(0.13, 0.05), spine,
    [0, -0.01, 0.085], [0, 0, 0], [1.15, 1, 0.5]);
  for (const side of [-1, 1]) {
    muscle("M_obliques_external", bellyGeometry(0.20, 0.04), spine,
      [side * 0.085, 0.05, 0.045], [0, 0, side * 0.12], [1, 1, 0.8]);
    muscle("M_obliques_internal", bellyGeometry(0.15, 0.03), spine,
      [side * 0.088, 0.02, 0.02], [0, 0, side * 0.12], [1, 1, 0.7]);
  }
  muscle("M_transverse_abdominis", bellyGeometry(0.16, 0.09), spine,
    [0, 0.04, 0.02], [0, 0, 0], [1.1, 1, 0.85]);
  for (const side of [-1, 1]) {
    muscle("M_iliopsoas", bellyGeometry(0.18, 0.028), pelvis,
      [side * 0.045, 0.02, 0.05], [0, 0, side * 0.06]);
  }

  // ---- 腕 ----
  const arms: Record<string, THREE.Group> = {};
  for (const [key, side] of [["L", 1], ["R", -1]] as const) {
    const shoulder = bone(chest, [side * 0.175, 0.175, 0]);
    const upper = bone(shoulder, [0, 0, 0], limbGeometry(0.28, 0.042, 0.036), [0, -0.14, 0]);
    const elbow = bone(upper, [0, -0.28, 0]);
    const fore = bone(elbow, [0, 0, 0], limbGeometry(0.25, 0.036, 0.028), [0, -0.125, 0]);
    const wrist = bone(fore, [0, -0.25, 0]);
    const hand = new THREE.Mesh(track(new THREE.BoxGeometry(0.055, 0.10, 0.03)), skinMat);
    hand.position.y = -0.05;
    wrist.add(hand);

    // 三角筋の3頭
    muscle("M_delt_anterior", bellyGeometry(0.11, 0.038), shoulder,
      [0, -0.035, 0.042], [0, 0, 0], [1, 1, 0.8]);
    muscle("M_delt_lateral", bellyGeometry(0.13, 0.045), shoulder,
      [side * 0.035, -0.03, 0], [0, 0, side * -0.12]);
    muscle("M_delt_posterior", bellyGeometry(0.11, 0.036), shoulder,
      [0, -0.035, -0.042], [0, 0, 0], [1, 1, 0.8]);

    // 上腕：二頭（前）・上腕筋（外側）・三頭の3頭（後）
    muscle("M_biceps_brachii", bellyGeometry(0.19, 0.036), upper,
      [0, -0.13, 0.036], [0, 0, 0], [0.9, 1, 0.9]);
    muscle("M_brachialis", bellyGeometry(0.12, 0.024), upper,
      [side * 0.032, -0.20, 0.018]);
    muscle("M_triceps_long", bellyGeometry(0.21, 0.032), upper,
      [side * -0.012, -0.13, -0.038]);
    muscle("M_triceps_lateral", bellyGeometry(0.16, 0.026), upper,
      [side * 0.034, -0.12, -0.026]);
    muscle("M_triceps_medial", bellyGeometry(0.12, 0.022), upper,
      [side * -0.032, -0.19, -0.026]);

    // 前腕
    muscle("M_brachioradialis", bellyGeometry(0.18, 0.026), fore,
      [side * 0.028, -0.08, 0.020]);
    muscle("M_forearm_flexors", bellyGeometry(0.16, 0.028), fore,
      [0, -0.09, 0.028], [0, 0, 0], [1.1, 1, 0.8]);
    muscle("M_forearm_extensors", bellyGeometry(0.16, 0.026), fore,
      [0, -0.09, -0.028], [0, 0, 0], [1.1, 1, 0.8]);

    arms[`shoulder${key}`] = shoulder;
    arms[`elbow${key}`] = elbow;
    arms[`wrist${key}`] = wrist;
  }

  // ---- 脚 ----
  const legs: Record<string, THREE.Group> = {};
  for (const [key, side] of [["L", 1], ["R", -1]] as const) {
    const hip = bone(pelvis, [side * 0.085, -0.08, 0]);
    const thigh = bone(hip, [0, 0, 0], limbGeometry(0.42, 0.068, 0.055), [0, -0.21, 0]);
    const knee = bone(thigh, [0, -0.42, 0]);
    const shin = bone(knee, [0, 0, 0], limbGeometry(0.40, 0.052, 0.035), [0, -0.20, 0]);
    const ankle = bone(shin, [0, -0.40, 0]);
    const foot = new THREE.Mesh(track(new THREE.BoxGeometry(0.075, 0.045, 0.20)), skinMat);
    foot.position.set(0, -0.022, 0.055);
    ankle.add(foot);

    muscle("M_gluteus_maximus", bellyGeometry(0.19, 0.070), hip,
      [0, 0.03, -0.065], [0, 0, 0], [1, 1, 0.75]);
    muscle("M_quadriceps", bellyGeometry(0.34, 0.058), thigh,
      [side * 0.018, -0.20, 0.032], [0, 0, 0], [1.05, 1, 0.9]);
    muscle("M_rectus_femoris", bellyGeometry(0.36, 0.032), thigh,
      [0, -0.19, 0.055]);
    muscle("M_hamstrings", bellyGeometry(0.32, 0.050), thigh,
      [0, -0.19, -0.048], [0, 0, 0], [1.1, 1, 0.85]);
    muscle("M_adductors", bellyGeometry(0.28, 0.036), thigh,
      [side * -0.042, -0.17, 0]);
    muscle("M_gastrocnemius", bellyGeometry(0.22, 0.046), shin,
      [0, -0.12, -0.038], [0, 0, 0], [1.15, 1, 0.9]);
    muscle("M_soleus", bellyGeometry(0.20, 0.032), shin,
      [0, -0.20, -0.030], [0, 0, 0], [1.1, 1, 0.9]);

    legs[`hip${key}`] = hip;
    legs[`knee${key}`] = knee;
    legs[`ankle${key}`] = ankle;
  }

  const joints = {
    pelvis, spine, chest, neck,
    shoulderL: arms.shoulderL, shoulderR: arms.shoulderR,
    elbowL: arms.elbowL, elbowR: arms.elbowR,
    wristL: arms.wristL, wristR: arms.wristR,
    hipL: legs.hipL, hipR: legs.hipR,
    kneeL: legs.kneeL, kneeR: legs.kneeR,
    ankleL: legs.ankleL, ankleR: legs.ankleR,
  } as Record<JointName, THREE.Object3D>;

  void BONEISH;

  return {
    root,
    joints,
    muscles,
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

/** 既定の色（何も強調していない状態） */
export const BASE_COLOR = new THREE.Color(SKIN);

export function resetMuscleColors(fig: Figure): void {
  for (const list of fig.muscles.values()) {
    for (const m of list) {
      (m.material as THREE.MeshStandardMaterial).color.copy(BASE_COLOR);
      (m.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    }
  }
}

export function paintMuscle(fig: Figure, meshNodeId: string, color: THREE.ColorRepresentation, glow = 0): void {
  const list = fig.muscles.get(meshNodeId);
  if (!list) return;
  for (const m of list) {
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.color.set(color);
    if (glow > 0) {
      mat.emissive.set(color);
      mat.emissiveIntensity = glow;
    }
  }
}
