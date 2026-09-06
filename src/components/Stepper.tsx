import type { Dispatch, SetStateAction } from "react";

/**
 * ジムで片手・親指で操作する前提の数値入力（NFR-3）。
 * キーボードを出さずに済むよう、増減ボタンを主操作にする。
 * 数値そのものを直接打ちたい場合に備えて、値部分は input にしてある。
 */
export function Stepper({
  label,
  unit,
  value,
  step,
  min = 0,
  max = 999,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  /**
   * 連打しても増分が落ちないよう、更新関数を受け取れる型にしてある。
   * 値を直接渡す実装だと、再レンダリング前の連続タップで
   * 古い value を基準に計算してしまい、増分が失われる。
   */
  onChange: Dispatch<SetStateAction<number>>;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const round = (v: number) => Math.round(v * 100) / 100;

  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button
          type="button"
          aria-label={`${label}を減らす`}
          onClick={() => onChange((v) => round(clamp(v - step)))}
        >
          −
        </button>
        <label className="stepper-value">
          <input
            type="number"
            inputMode="decimal"
            value={String(value)}
            step={step}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) onChange(round(clamp(v)));
            }}
            aria-label={`${label}（${unit}）`}
          />
          <span className="stepper-unit">{unit}</span>
        </label>
        <button
          type="button"
          aria-label={`${label}を増やす`}
          onClick={() => onChange((v) => round(clamp(v + step)))}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

/**
 * RIR（あと何回挙げられたか）。
 * 初心者は過大評価しがちなので、数値だけでなく意味を添える（RISK-2）。
 */
const RIR_HINT: Record<number, string> = {
  0: "限界",
  1: "あと1回",
  2: "あと2回",
  3: "あと3回以上",
};

export function RirPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rir">
      <span className="stepper-label">RIR（あと何回挙がったか）</span>
      <div className="rir-row">
        {[0, 1, 2, 3].map((v) => (
          <button
            key={v}
            type="button"
            className={v === value ? "on" : ""}
            onClick={() => onChange(v)}
            aria-pressed={v === value}
          >
            <b>{v === 3 ? "3+" : v}</b>
            <small>{RIR_HINT[v]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
