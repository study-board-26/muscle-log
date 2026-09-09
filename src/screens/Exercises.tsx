import { useState } from "react";
import { ExerciseForm } from "../components/ExerciseForm";
import { FormVideo } from "../components/FormVideo";
import { isCustom } from "../lib/customExercise";
import type { Exercise, Region } from "../data/types";
import {
  EQUIPMENT_LABEL,
  EVIDENCE_LABEL,
  REGIONS,
  ROLE_LABEL,
  type Master,
} from "../data/master";

function ExerciseCard({
  exercise,
  master,
  open,
  onToggle,
  onEdit,
}: {
  exercise: Exercise;
  master: Master;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const primes = exercise.muscles.filter((m) => m.role === "prime");
  const repLabel =
    exercise.unit === "weight_seconds"
      ? `${exercise.repRange[0]}〜${exercise.repRange[1]} 秒`
      : `${exercise.repRange[0]}〜${exercise.repRange[1]} 回`;

  return (
    <article className={`card${open ? " open" : ""}`}>
      <button type="button" className="card-head" onClick={onToggle} aria-expanded={open}>
        <span className="card-code">{exercise.code}</span>
        <span className="card-name">{exercise.name}</span>
        <span className="card-meta">
          <span className={`chip ev-${exercise.evidence.level}`}>
            {EVIDENCE_LABEL[exercise.evidence.level]}
          </span>
          {/* P1 は収録済み種目の開発フェーズの印。自作の種目には意味がない */}
          {!isCustom(exercise) && exercise.phase === 1 && (
            <span className="chip phase">P1</span>
          )}
        </span>
        <span className="card-sub">
          {primes.map((m) => master.muscleById.get(m.muscleId)?.nameJa).join("・")}
          <span className="dot">·</span>
          {repLabel}
        </span>
      </button>

      {open && (
        <div className="card-body">
          {/* フォーム解説動画（FR-A2） */}
          <FormVideo exercise={exercise} />

          {exercise.criticalNote && <p className="critical">{exercise.criticalNote}</p>}

          <dl className="kv">
            <dt>器具</dt>
            <dd>
              {exercise.equipment.map((e) => (
                <span key={e} className="chip eq">
                  {EQUIPMENT_LABEL[e] ?? e}
                </span>
              ))}
            </dd>

            <dt>使う筋</dt>
            <dd className="muscles">
              {exercise.muscles.map((m) => (
                <span key={m.muscleId} className={`muscle role-${m.role}`}>
                  {master.muscleById.get(m.muscleId)?.nameJa ?? m.muscleId}
                  <small>{ROLE_LABEL[m.role]}</small>
                </span>
              ))}
            </dd>

            <dt>漸進幅</dt>
            <dd>
              {exercise.progressionStepKg > 0
                ? `+${exercise.progressionStepKg} kg`
                : "加重なし（難易度で漸進）"}
            </dd>
          </dl>

          <section className="block">
            <h3>根拠</h3>
            <p>{exercise.evidence.summary}</p>
            {exercise.evidence.refs.length > 0 && (
              <ul className="refs">
                {exercise.evidence.refs.map((id) => {
                  const r = master.referenceById.get(id);
                  if (!r) return null;
                  return (
                    <li key={id}>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.citation}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {exercise.cues.length > 0 && (
            <section className="block">
              <h3>効かせるコツ</h3>
              <ul>
                {exercise.cues.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {exercise.commonErrors.length > 0 && (
            <section className="block">
              <h3>よくある失敗</h3>
              <ul>
                {exercise.commonErrors.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {isCustom(exercise) && (
            <button type="button" className="sub-btn" onClick={onEdit}>
              この種目を直す
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function Exercises({
  master,
  onMasterChanged,
}: {
  master: Master;
  /** 自作の種目を足す・直すと一覧が変わるので、マスタを読み直してもらう */
  onMasterChanged: () => void;
}) {
  const [region, setRegion] = useState<Region>("chest");
  const [openId, setOpenId] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<Exercise | null | undefined>(undefined);
  const list = master.exercises.filter((e) => e.region === region);

  // undefined は閉じている状態。null は新規、Exercise は編集
  if (formFor !== undefined) {
    return (
      <ExerciseForm
        master={master}
        editing={formFor}
        onSaved={onMasterChanged}
        onClose={() => setFormFor(undefined)}
      />
    );
  }

  return (
    <main>
      <nav className="tabs" aria-label="部位">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={r.id === region ? "on" : ""}
            onClick={() => {
              setRegion(r.id);
              setOpenId(null);
            }}
          >
            {r.label}
          </button>
        ))}
      </nav>

      <div className="list">
        {list.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            master={master}
            open={openId === ex.id}
            onToggle={() => setOpenId(openId === ex.id ? null : ex.id)}
            onEdit={() => setFormFor(ex)}
          />
        ))}

        <button type="button" className="sub-btn add-ex" onClick={() => setFormFor(null)}>
          種目を追加する
        </button>
      </div>
    </main>
  );
}
