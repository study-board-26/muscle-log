import { useState } from "react";
import type { Region } from "../data/types";
import { REGIONS, type Master } from "../data/master";
import { isCustom } from "../lib/customExercise";

export function ExercisePicker({
  master,
  onPick,
  onClose,
}: {
  master: Master;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const [region, setRegion] = useState<Region>("chest");
  const list = master.exercises.filter((e) => e.region === region);

  return (
    <div className="sheet" role="dialog" aria-label="種目を選ぶ">
      <div className="sheet-head">
        <h2>種目を選ぶ</h2>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>

      <nav className="tabs" aria-label="部位">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={r.id === region ? "on" : ""}
            onClick={() => setRegion(r.id)}
          >
            {r.label}
          </button>
        ))}
      </nav>

      <div className="pick-list">
        {list.map((ex) => (
          <button key={ex.id} type="button" onClick={() => onPick(ex.id)}>
            <span className="pick-code">{ex.code}</span>
            <span className="pick-name">{ex.name}</span>
            <span className="pick-meta">
              {ex.repRange[0]}〜{ex.repRange[1]}
              {ex.unit === "weight_seconds" ? "秒" : "回"}
              {!isCustom(ex) && ex.phase === 1 && <span className="chip phase">P1</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
