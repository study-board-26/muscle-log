import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Exercise } from "../data/types";
import type { Master } from "../data/master";
import { buildFigure, resetMuscleColors, type Figure, type JointName } from "../three/figure.ts";
import { motionFor, type Pose } from "../three/motions.ts";

/** 主働・協働・安定の3段階。凡例の色と一致させる */
const ROLE_COLOR = {
  prime: 0xe0796e,
  secondary: 0xdcaf57,
  stabilizer: 0x4d6070,
} as const;

const EASE = (t: number) => t * t * (3 - 2 * t);

function applyPose(fig: Figure, a: Pose, b: Pose, t: number) {
  const names = new Set<JointName>([
    ...(Object.keys(a) as JointName[]),
    ...(Object.keys(b) as JointName[]),
  ]);
  for (const name of names) {
    const joint = fig.joints[name];
    if (!joint) continue;
    const from = a[name] ?? [0, 0, 0];
    const to = b[name] ?? [0, 0, 0];
    joint.rotation.set(
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t
    );
  }
}

export function MuscleViewer({
  exercise,
  master,
}: {
  exercise: Exercise;
  master: Master;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  const stateRef = useRef({ playing: true, slow: false, azimuth: 0, drag: 0 });

  const { motion, defined } = motionFor(exercise.id);

  useEffect(() => {
    stateRef.current.playing = playing;
    stateRef.current.slow = slow;
  }, [playing, slow]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);

    scene.add(new THREE.HemisphereLight(0xbcd4ea, 0x0d1218, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(2.2, 3.2, 2.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb8e8, 0.7);
    rim.position.set(-2.4, 1.4, -2.2);
    scene.add(rim);

    const fig = buildFigure();
    const pivot = new THREE.Group();
    pivot.add(fig.root);
    scene.add(pivot);

    if (motion.rootRotation) fig.root.rotation.set(...motion.rootRotation);
    if (motion.rootPosition) fig.root.position.set(...motion.rootPosition);

    // 筋の色分け（FR-A3）。役割ごとに3段階
    resetMuscleColors(fig);
    for (const em of exercise.muscles) {
      const mu = master.muscleById.get(em.muscleId);
      if (!mu) continue;
      const list = fig.muscles.get(mu.meshNodeId);
      if (!list) continue;
      const color = ROLE_COLOR[em.role];
      for (const mesh of list) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(color);
        if (em.role === "prime") {
          mat.emissive.setHex(color);
          mat.emissiveIntensity = 0.28;
        }
      }
    }

    stateRef.current.azimuth = motion.view ?? 0.55;

    // ドラッグで回す（FR-A2）
    let pointerDown = false;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      pointerDown = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      stateRef.current.azimuth -= (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const onUp = () => {
      pointerDown = false;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      // updateStyle を省略しないこと。false にすると canvas の CSS サイズが
      // 描画バッファの実寸のままになり、枠からはみ出して左上しか見えなくなる。
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    /*
     * カメラの寄せ方は姿勢から自動で決める。
     * 仰向けや前傾では体の位置が大きくずれるため、固定値だと枠から外れる。
     * 開始姿勢と終了姿勢の両方を含む範囲を取り、動作中も見切れないようにする。
     */
    const framing = (() => {
      const box = new THREE.Box3();
      const primeCenter = new THREE.Vector3();
      let primeCount = 0;

      for (const t of [0, 1]) {
        applyPose(fig, motion.start, motion.end, t);
        pivot.updateMatrixWorld(true);
        box.union(new THREE.Box3().setFromObject(fig.root));
      }

      // 注視点は主働筋の重心に置く。体の外接直方体の中心だと、
      // 仰向けの種目では足まで含めた中点になり、肝心の部位が端に寄る。
      for (const em of exercise.muscles) {
        if (em.role !== "prime") continue;
        const mu = master.muscleById.get(em.muscleId);
        const list = mu ? fig.muscles.get(mu.meshNodeId) : undefined;
        if (!list) continue;
        for (const mesh of list) {
          primeCenter.add(mesh.getWorldPosition(new THREE.Vector3()));
          primeCount++;
        }
      }

      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z) / 2;
      const fov = (camera.fov * Math.PI) / 180;
      const target =
        primeCount > 0
          ? primeCenter.divideScalar(primeCount)
          : box.getCenter(new THREE.Vector3());

      return { target, dist: (radius / Math.tan(fov / 2)) * 1.25 };
    })();
    const target = framing.target;
    const dist = framing.dist;

    let t = 0;
    let last = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const st = stateRef.current;
      if (st.playing) {
        t += dt / (motion.period * (st.slow ? 2.2 : 1));
        if (t > 1) t -= 1;
      }
      // 0→1→0 の往復
      const phase = t < 0.5 ? t * 2 : (1 - t) * 2;
      applyPose(fig, motion.start, motion.end, EASE(phase));

      const a = st.azimuth;
      camera.position.set(
        target.x + Math.sin(a) * dist,
        target.y + dist * 0.18,
        target.z + Math.cos(a) * dist
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      fig.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [exercise, master, motion]);

  const primes = exercise.muscles.filter((m) => m.role === "prime");
  const seconds = exercise.muscles.filter((m) => m.role === "secondary");

  return (
    <div className="viewer">
      <div className="viewer-canvas" ref={hostRef} />

      <div className="viewer-ctl">
        <button type="button" onClick={() => setPlaying((v) => !v)}>
          {playing ? "一時停止" : "再生"}
        </button>
        <button type="button" className={slow ? "on" : ""} onClick={() => setSlow((v) => !v)}>
          スロー
        </button>
        <span className="viewer-hint">左右にドラッグで回転</span>
      </div>

      {/* 色だけに頼らず名前も併記する（NFR-7） */}
      <div className="legend3d">
        <div>
          <span className="sw prime" />
          <span className="lb">主働</span>
          <span className="ms">
            {primes.map((m) => master.muscleById.get(m.muscleId)?.nameJa).join("・")}
          </span>
        </div>
        {seconds.length > 0 && (
          <div>
            <span className="sw secondary" />
            <span className="lb">協働</span>
            <span className="ms">
              {seconds.map((m) => master.muscleById.get(m.muscleId)?.nameJa).join("・")}
            </span>
          </div>
        )}
      </div>

      {!defined && (
        <p className="viewer-note">
          この種目の動作はまだ未作成です。色分けは正しく表示されています。
        </p>
      )}
    </div>
  );
}
