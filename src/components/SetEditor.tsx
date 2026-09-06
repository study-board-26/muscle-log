import { useState } from "react";
import type { Exercise } from "../data/types";
import { updateSet, type SetLogRec } from "../db";
import { RirPicker, Stepper } from "./Stepper";

/**
 * FR-B8 記録した1セットの値を修正する。
 *
 * 修正対象は入力値だけ。種目やセッションの付け替えはできない。
 * 種目を間違えた場合は削除して記録し直す運用にしている。
 */
export function SetEditor({
  set,
  exercise,
  onSaved,
  onCancel,
}: {
  set: SetLogRec;
  exercise: Exercise | undefined;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isSeconds = set.unit === "weight_seconds";
  const [weight, setWeight] = useState(set.weight);
  const [amount, setAmount] = useState((isSeconds ? set.seconds : set.reps) ?? 1);
  const [rir, setRir] = useState(set.rir);
  const [saving, setSaving] = useState(false);

  const needsWeight = exercise ? !exercise.equipment.includes("bodyweight") : true;
  const step = exercise && exercise.progressionStepKg > 0 ? exercise.progressionStepKg : 2.5;
  const invalid = (needsWeight && weight <= 0) || amount <= 0;

  return (
    <div className="set-edit">
      <p className="set-edit-title">{exercise?.name ?? set.exerciseId} の修正</p>

      <div className="inputs">
        <Stepper
          label="重量"
          unit="kg"
          value={weight}
          step={step}
          max={500}
          onChange={setWeight}
        />
        <Stepper
          label={isSeconds ? "秒数" : "レップ"}
          unit={isSeconds ? "秒" : "回"}
          value={amount}
          step={isSeconds ? 5 : 1}
          min={1}
          max={isSeconds ? 300 : 100}
          onChange={setAmount}
        />
      </div>

      <RirPicker value={rir} onChange={setRir} />

      {invalid && (
        <p className="warn">重量とレップは1以上で入力してください。</p>
      )}

      <div className="set-edit-actions">
        <button
          type="button"
          className="log-btn"
          disabled={saving || invalid}
          onClick={async () => {
            setSaving(true);
            try {
              await updateSet(set.id, {
                weight,
                reps: isSeconds ? null : amount,
                seconds: isSeconds ? amount : null,
                rir,
              });
              onSaved();
            } finally {
              setSaving(false);
            }
          }}
        >
          保存
        </button>
        <button type="button" className="sub-btn" onClick={onCancel}>
          やめる
        </button>
      </div>
    </div>
  );
}
