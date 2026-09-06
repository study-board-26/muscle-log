import type { Exercise } from "../data/types";

/**
 * FR-B4 レストタイマー
 * 目標レップ帯に応じた推奨秒数。低レップ＝高強度ほど長く取る。
 */
export function recommendedRestSec(exercise: Exercise): number {
  if (exercise.unit === "weight_seconds") return 90;
  const [, hi] = exercise.repRange;
  if (hi <= 8) return 180;
  if (hi <= 12) return 120;
  return 90;
}

export function formatMMSS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * iOS は navigator.vibrate を実装していないため、音で知らせる。
 * AudioContext はユーザー操作を起点に生成しないと鳴らないので、
 * セット記録のタップ時に prime() を呼んでおく。
 */
let ctx: AudioContext | null = null;

export function primeAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
}

export function beep(): void {
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    const t = now + i * 0.28;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  }
}
