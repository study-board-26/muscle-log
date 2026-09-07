import { useState } from "react";
import type { Master } from "../data/master";
import { TEMPLATES, dayLabel } from "../data/routineTemplates";
import { clearRoutine, putRoutine, type RoutineRec } from "../db";
import { ExercisePicker } from "./ExercisePicker";

/**
 * FR-E2 / FR-E3 ルーティンの選択と編集。
 *
 * タブを増やさずに済むよう、記録画面から開く全画面シートにしている。
 * 有効なルーティンは常に1つ（個人利用のため）。
 */
export function RoutineSheet({
  master,
  routine,
  onSaved,
  onClose,
}: {
  master: Master;
  routine: RoutineRec | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RoutineRec | null>(routine);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  const update = (next: RoutineRec) => {
    setDraft(next);
    setDirty(true);
  };

  /**
   * 保存済みルーティンはテンプレを作った時点のスナップショットなので、
   * テンプレ側の内容が変わっても自動では追従しない。
   * 中身が食い違っている時だけ、置き換える導線を出す。
   */
  const outdated = (() => {
    if (!draft) return null;
    const tpl = TEMPLATES.find((t) => t.name === draft.name);
    if (!tpl) return null;
    const shape = (r: RoutineRec) =>
      JSON.stringify(r.days.map((d) => [d.dayOfWeek, d.label, d.items.map((i) => [i.exerciseId, i.sets])]));
    return shape(tpl.build()) === shape(draft) ? null : tpl;
  })();

  const editDay = (dayIndex: number, fn: (items: RoutineRec["days"][0]["items"]) => RoutineRec["days"][0]["items"]) => {
    if (!draft) return;
    const days = draft.days.map((d, i) => (i === dayIndex ? { ...d, items: fn(d.items) } : d));
    update({ ...draft, days });
  };

  if (pickFor !== null && draft) {
    return (
      <ExercisePicker
        master={master}
        onClose={() => setPickFor(null)}
        onPick={(exerciseId) => {
          editDay(pickFor, (items) => [...items, { exerciseId, sets: 3 }]);
          setPickFor(null);
        }}
      />
    );
  }

  return (
    <div className="sheet" role="dialog" aria-label="ルーティン">
      <div className="sheet-head">
        <h2>ルーティン</h2>
        <button
          type="button"
          onClick={async () => {
            if (dirty && draft) await putRoutine(draft);
            onSaved();
            onClose();
          }}
        >
          {dirty ? "保存して閉じる" : "閉じる"}
        </button>
      </div>

      {!draft ? (
        <div className="rt-templates">
          <p className="hint">
            分割法を選ぶと、その場でルーティンが作られます。あとから種目もセット数も変えられます。
          </p>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="rt-tpl"
              onClick={() => update(t.build())}
            >
              <span className="rt-tpl-name">{t.name}</span>
              <span className="rt-tpl-sum">{t.summary}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="rt-name">{draft.name}</p>

          {outdated && (
            <div className="rt-outdated">
              <p>
                このルーティンは古い内容のままです。最新のメニューに置き換えられます
                （セット数の調整など、加えた変更は消えます）。
              </p>
              <button
                type="button"
                className="sub-btn"
                onClick={() => {
                  if (!confirm(`「${outdated.name}」を最新のメニューに置き換えます。よろしいですか？`)) return;
                  update(outdated.build());
                }}
              >
                最新のメニューに置き換える
              </button>
            </div>
          )}

          {draft.days.map((day, di) => (
            <section key={`${day.dayOfWeek}-${di}`} className="rt-day">
              <header>
                <span className="rt-dow">{dayLabel(day.dayOfWeek)}</span>
                <span className="rt-label">{day.label}</span>
                <span className="rt-sets">
                  {day.items.reduce((a, i) => a + i.sets, 0)} セット
                </span>
              </header>

              <ul className="rt-items">
                {day.items.map((item, ii) => {
                  const ex = master.exercises.find((e) => e.id === item.exerciseId);
                  return (
                    <li key={`${item.exerciseId}-${ii}`}>
                      <span className="rt-code">{ex?.code ?? "—"}</span>
                      <span className="rt-ex">{ex?.name ?? item.exerciseId}</span>
                      <span className="rt-count">
                        <button
                          type="button"
                          aria-label="セット数を減らす"
                          onClick={() =>
                            editDay(di, (items) =>
                              items.map((x, k) =>
                                k === ii ? { ...x, sets: Math.max(1, x.sets - 1) } : x
                              )
                            )
                          }
                        >
                          −
                        </button>
                        <b>{item.sets}</b>
                        <button
                          type="button"
                          aria-label="セット数を増やす"
                          onClick={() =>
                            editDay(di, (items) =>
                              items.map((x, k) =>
                                k === ii ? { ...x, sets: Math.min(10, x.sets + 1) } : x
                              )
                            )
                          }
                        >
                          ＋
                        </button>
                      </span>
                      <button
                        type="button"
                        className="rt-up"
                        aria-label="上へ移動"
                        disabled={ii === 0}
                        onClick={() =>
                          editDay(di, (items) => {
                            const next = [...items];
                            [next[ii - 1], next[ii]] = [next[ii], next[ii - 1]];
                            return next;
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rt-del"
                        aria-label="種目を外す"
                        onClick={() => editDay(di, (items) => items.filter((_, k) => k !== ii))}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button type="button" className="sub-btn rt-add" onClick={() => setPickFor(di)}>
                種目を追加
              </button>
            </section>
          ))}

          <button
            type="button"
            className="sub-btn danger-outline"
            onClick={async () => {
              await clearRoutine();
              setDraft(null);
              setDirty(false);
              onSaved();
            }}
          >
            ルーティンを削除して選び直す
          </button>
        </>
      )}
    </div>
  );
}
