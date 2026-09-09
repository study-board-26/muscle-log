import { useState } from "react";
import { EQUIPMENT_LABEL, REGIONS, ROLE_LABEL, type Master } from "../data/master";
import type { Equipment, Exercise, LogUnit, MuscleRole, Region } from "../data/types";
import {
  buildExercise,
  EMPTY_INPUT,
  toInput,
  validateInput,
  type CustomExerciseInput,
} from "../lib/customExercise";
import { countSetsForExercise, deleteCustomExercise, putCustomExercise } from "../db";
import { Stepper } from "./Stepper";

/**
 * FR-A11 自作の種目を作る・直す。
 *
 * 収録済みの種目と同じ量の入力は求めない。アルゴリズムが動くのに要る項目
 * だけを必須にし、それ以外（コツ・動画）は任意にしている。
 * 何を必須にしたかの理由は lib/customExercise.ts を参照。
 */
export function ExerciseForm({
  master,
  editing,
  onSaved,
  onClose,
}: {
  master: Master;
  /** 既存の自作種目を直す場合。新規なら null */
  editing: Exercise | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState<CustomExerciseInput>(() =>
    editing ? toInput(editing) : EMPTY_INPUT
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const patch = (p: Partial<CustomExerciseInput>) => setInput((v) => ({ ...v, ...p }));

  const roleOf = (muscleId: string): MuscleRole | null =>
    input.muscles.find((m) => m.muscleId === muscleId)?.role ?? null;

  /** 未選択 → 主働 → 協働 → 未選択 と回す。行をタップするだけで決められる */
  const cycleMuscle = (muscleId: string) => {
    const cur = roleOf(muscleId);
    const next: MuscleRole | null =
      cur === null ? "prime" : cur === "prime" ? "secondary" : null;
    setInput((v) => ({
      ...v,
      muscles:
        next === null
          ? v.muscles.filter((m) => m.muscleId !== muscleId)
          : [...v.muscles.filter((m) => m.muscleId !== muscleId), { muscleId, role: next }],
    }));
  };

  const save = async () => {
    const errs = validateInput(input);
    setErrors(errs);
    if (errs.length || busy) return;
    setBusy(true);
    try {
      await putCustomExercise(buildExercise(input, master.exercises, editing ?? undefined));
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const n = await countSetsForExercise(editing.id);
      if (n > 0) {
        setErrors([
          `この種目には ${n} セットの記録があるため削除できません。` +
            "消すと e1RM の推移と週間ボリュームが、種目名を引けない記録を抱えることになります。",
        ]);
        return;
      }
      if (!confirm(`「${editing.name}」を削除します。よろしいですか？`)) return;
      await deleteCustomExercise(editing.id);
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const isSeconds = input.unit === "weight_seconds";

  return (
    <div className="sheet" role="dialog" aria-label={editing ? "種目を直す" : "種目を追加"}>
      <div className="sheet-head">
        <h2>{editing ? "種目を直す" : "種目を追加"}</h2>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="form-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <label className="field">
        <span className="stepper-label">種目名</span>
        <input
          type="text"
          value={input.name}
          placeholder="例：ケーブル・プルオーバー"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>

      <div className="field">
        <span className="stepper-label">部位</span>
        <div className="chip-row">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={input.region === r.id ? "on" : ""}
              aria-pressed={input.region === r.id}
              onClick={() => patch({ region: r.id as Region })}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="stepper-label">使う筋</span>
        <p className="hint">
          タップで 主働 → 協働 → 解除。週間ボリュームは主働1.0・協働0.5で数えます（ALG-2）。
          <b>主働を1つ以上選ばないと分析に出ません。</b>
        </p>
        <div className="mus-pick">
          {REGIONS.map((r) => {
            const ms = master.muscles.filter((m) => m.region === r.id && m.group);
            if (ms.length === 0) return null;
            return (
              <div key={r.id} className="mus-group">
                <span className="mus-region">{r.label}</span>
                <div className="chip-row">
                  {ms.map((m) => {
                    const role = roleOf(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={role ? `on role-${role}` : ""}
                        aria-pressed={role !== null}
                        onClick={() => cycleMuscle(m.id)}
                      >
                        {m.nameJa}
                        {role && <b>{ROLE_LABEL[role]}</b>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="field">
        <span className="stepper-label">記録の単位</span>
        <div className="chip-row">
          {(
            [
              ["weight_reps", "重量 × 回数"],
              ["weight_seconds", "重量 × 秒数"],
            ] as [LogUnit, string][]
          ).map(([u, label]) => (
            <button
              key={u}
              type="button"
              className={input.unit === u ? "on" : ""}
              aria-pressed={input.unit === u}
              onClick={() => patch({ unit: u })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Stepper
        label={isSeconds ? "目標秒数の下限" : "目標レップの下限"}
        unit={isSeconds ? "秒" : "回"}
        value={input.repRange[0]}
        step={1}
        min={1}
        max={60}
        onChange={(v) =>
          setInput((s) => {
            const lo = typeof v === "function" ? v(s.repRange[0]) : v;
            return { ...s, repRange: [lo, s.repRange[1]] };
          })
        }
      />
      <Stepper
        label={isSeconds ? "目標秒数の上限" : "目標レップの上限"}
        unit={isSeconds ? "秒" : "回"}
        value={input.repRange[1]}
        step={1}
        min={1}
        max={60}
        onChange={(v) =>
          setInput((s) => {
            const hi = typeof v === "function" ? v(s.repRange[1]) : v;
            return { ...s, repRange: [s.repRange[0], hi] };
          })
        }
      />
      <Stepper
        label="1段階の増量幅"
        unit="kg"
        value={input.progressionStepKg}
        step={0.5}
        min={0.5}
        max={20}
        onChange={(v) =>
          setInput((s) => ({
            ...s,
            progressionStepKg: typeof v === "function" ? v(s.progressionStepKg) : v,
          }))
        }
      />

      <div className="field">
        <span className="stepper-label">多関節種目か</span>
        <p className="hint">
          デロード判定（ALG-4）は多関節種目だけを見ます。単関節は疲労の指標として
          当てにならないためです。所要時間の見積り（ALG-7）も多関節を長めに数えます。
        </p>
        <div className="chip-row">
          {([[true, "多関節（スクワット等）"], [false, "単関節（カール等）"]] as [boolean, string][]).map(
            ([v, label]) => (
              <button
                key={String(v)}
                type="button"
                className={input.compound === v ? "on" : ""}
                aria-pressed={input.compound === v}
                onClick={() => patch({ compound: v })}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      <div className="field">
        <span className="stepper-label">器具（任意）</span>
        <div className="chip-row">
          {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((eq) => {
            const on = input.equipment.includes(eq);
            return (
              <button
                key={eq}
                type="button"
                className={on ? "on" : ""}
                aria-pressed={on}
                onClick={() =>
                  patch({
                    equipment: on
                      ? input.equipment.filter((x) => x !== eq)
                      : [...input.equipment, eq],
                  })
                }
              >
                {EQUIPMENT_LABEL[eq]}
              </button>
            );
          })}
        </div>
      </div>

      <label className="field">
        <span className="stepper-label">効かせるコツ（任意・1行に1つ）</span>
        <textarea
          className="form-area"
          rows={3}
          value={input.cues.join("\n")}
          placeholder="肘を体側の後ろへ送る"
          onChange={(e) => patch({ cues: e.target.value.split("\n") })}
        />
      </label>

      <label className="field">
        <span className="stepper-label">フォーム解説動画のURL（任意）</span>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={input.videoUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          onChange={(e) => patch({ videoUrl: e.target.value })}
        />
      </label>

      <button type="button" className="log-btn" disabled={busy} onClick={() => void save()}>
        {editing ? "保存する" : "この種目を追加する"}
      </button>

      {editing && (
        <button
          type="button"
          className="sub-btn danger-outline"
          disabled={busy}
          onClick={() => void remove()}
        >
          この種目を削除する
        </button>
      )}
    </div>
  );
}
