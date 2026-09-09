import { useCallback, useEffect, useState } from "react";
import type { Exercise } from "../data/types";
import {
  addSet,
  deleteSet,
  getPreviousSets,
  getProgression,
  getSetting,
  putProgression,
  type SetLogRec,
} from "../db";
import { formatKg, setE1rm } from "../lib/e1rm";
import {
  estimateStartWeight,
  suggestNext,
  type Experience,
  type Suggestion,
} from "../lib/progression";
import { primeAudio, recommendedRestSec } from "../lib/rest";
import { RirPicker, Stepper } from "./Stepper";
import { SetEditor } from "./SetEditor";

function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function describeSet(s: SetLogRec): string {
  const v = s.unit === "weight_seconds" ? `${s.seconds}秒` : `${s.reps}回`;
  return `${formatKg(s.weight)}kg × ${v} RIR${s.rir}`;
}

export function ExercisePanel({
  exercise,
  sessionId,
  todaySets,
  onLogged,
  onStartRest,
}: {
  exercise: Exercise;
  sessionId: string;
  todaySets: SetLogRec[];
  onLogged: () => void;
  onStartRest: (sec: number) => void;
}) {
  const isSeconds = exercise.unit === "weight_seconds";
  const [lo] = exercise.repRange;
  /**
   * 自重種目は 0kg が正しい記録だが、それ以外で 0kg を許すと
   * e1RM が算出できず、ボリューム集計にも意味のない行が混ざる。
   */
  const needsWeight = !exercise.equipment.includes("bodyweight");

  const [prev, setPrev] = useState<{ sessionId: string; sets: SetLogRec[] } | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [estimate, setEstimate] = useState<{ weight: number; note: string } | null>(null);

  const [weight, setWeight] = useState(0);
  const [amount, setAmount] = useState(lo);
  const [rir, setRir] = useState(2);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // 種目が変わるたびに、前回記録と提案を読み直す
  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, state, bw, exp] = await Promise.all([
        getPreviousSets(exercise.id, sessionId),
        getProgression(exercise.id),
        getSetting<number>("bodyWeightKg"),
        getSetting<Experience>("experience"),
      ]);
      if (!alive) return;

      setPrev(p);
      const s = suggestNext(exercise, p?.sets ?? [], state);
      setSuggestion(s);

      let est: { weight: number; note: string } | null = null;
      if (s.kind === "first" && s.weight === null && bw) {
        est = estimateStartWeight(exercise, bw, exp ?? "beginner");
      }
      setEstimate(est);

      setWeight(s.weight ?? est?.weight ?? 0);
      setAmount(s.target);
      setRir(2);
    })();
    return () => {
      alive = false;
    };
  }, [exercise, sessionId]);

  // 同一セッション内の2セット目以降は、直前のセットを初期値に引き継ぐ（FR-B2）
  useEffect(() => {
    const mine = todaySets.filter((s) => s.exerciseId === exercise.id);
    if (mine.length === 0) return;
    const last = mine[mine.length - 1];
    setWeight(last.weight);
    setAmount((isSeconds ? last.seconds : last.reps) ?? lo);
  }, [todaySets, exercise.id, isSeconds, lo]);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    primeAudio();
    try {
      const mine = todaySets.filter((s) => s.exerciseId === exercise.id);
      await addSet({
        sessionId,
        exerciseId: exercise.id,
        setIndex: mine.length,
        type: "main",
        unit: exercise.unit,
        weight,
        reps: isSeconds ? null : amount,
        seconds: isSeconds ? amount : null,
        rir,
        side: "both",
        restSec: recommendedRestSec(exercise),
      });

      // 失敗の連続回数は提案の判断材料なので、記録のたびに保存しておく
      if (suggestion) {
        await putProgression({
          exerciseId: exercise.id,
          currentWeight: weight,
          currentRepTarget: amount,
          consecutiveFailures: suggestion.consecutiveFailures,
          lastDeloadAt: null,
          updatedAt: Date.now(),
        });
      }

      onStartRest(recommendedRestSec(exercise));
      onLogged();
    } finally {
      setSaving(false);
    }
  }, [
    saving, todaySets, exercise, sessionId, weight, amount, rir,
    isSeconds, suggestion, onLogged, onStartRest,
  ]);

  const mine = todaySets.filter((s) => s.exerciseId === exercise.id);
  const prevBest = prev
    ? prev.sets.map(setE1rm).filter((v): v is number => v !== null).sort((a, b) => b - a)[0]
    : undefined;
  const todayBest = mine
    .map(setE1rm)
    .filter((v): v is number => v !== null)
    .sort((a, b) => b - a)[0];
  const delta =
    prevBest !== undefined && todayBest !== undefined ? todayBest - prevBest : null;

  return (
    <section className="panel-ex">
      <header className="panel-ex-head">
        <span className="card-code">{exercise.code}</span>
        <h2>{exercise.name}</h2>
        {/*
          フォームを確認したいのは種目をやる直前で、そのときいるのはこの画面。
          種目タブへ移動して探し直さずに済むよう、ここからも開けるようにする。
        */}
        {exercise.video && (
          <a
            className="fv-mini"
            href={exercise.video.url}
            target="_blank"
            rel="noreferrer"
            title={exercise.video.title}
          >
            <span aria-hidden="true">▶</span> フォーム
          </a>
        )}
      </header>

      {exercise.criticalNote && <p className="critical">{exercise.criticalNote}</p>}

      {suggestion && (
        <div className={`suggest kind-${suggestion.kind}`}>
          <div className="suggest-head">
            <span className="suggest-tag">
              {suggestion.kind === "up" && "重量を上げる"}
              {suggestion.kind === "hold" && "据え置き"}
              {suggestion.kind === "down" && "落として立て直す"}
              {suggestion.kind === "first" && "初回"}
            </span>
            {suggestion.weight !== null && (
              <span className="suggest-main">
                {formatKg(suggestion.weight)}kg × {suggestion.target}
                {isSeconds ? "秒" : "回"}
              </span>
            )}
          </div>
          <p>{suggestion.reason}</p>
          {estimate && <p className="suggest-est">{estimate.note}</p>}
        </div>
      )}

      {/* FR-B3 前回記録は入力欄の直上に常時表示する */}
      <div className="prev">
        <span className="prev-label">
          前回{prev ? `（${formatDay(prev.sets[0].loggedAt)}）` : ""}
        </span>
        {prev ? (
          <>
            <ul>
              {prev.sets.map((s) => (
                <li key={s.id}>{describeSet(s)}</li>
              ))}
            </ul>
            {delta !== null && (
              <span className={`delta ${delta >= 0 ? "up" : "down"}`}>
                e1RM {delta >= 0 ? "+" : ""}
                {formatKg(delta)}kg
              </span>
            )}
          </>
        ) : (
          <p className="prev-none">記録なし</p>
        )}
      </div>

      <div className="inputs">
        <Stepper
          label="重量"
          unit="kg"
          value={weight}
          step={exercise.progressionStepKg > 0 ? exercise.progressionStepKg : 2.5}
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

      {needsWeight && weight <= 0 && (
        <p className="warn">
          重量を入力してください。0kg では記録できません（e1RMも算出できません）。
        </p>
      )}

      <button
        type="button"
        className="log-btn"
        onClick={save}
        disabled={saving || (needsWeight && weight <= 0) || amount <= 0}
      >
        {mine.length + 1} セット目を記録
      </button>

      {mine.length > 0 && (
        <ul className="today-sets">
          {mine.map((s, i) => {
            const v = setE1rm(s);
            if (editId === s.id) {
              return (
                <li key={s.id} className="editing">
                  <SetEditor
                    set={s}
                    exercise={exercise}
                    onCancel={() => setEditId(null)}
                    onSaved={() => {
                      setEditId(null);
                      onLogged();
                    }}
                  />
                </li>
              );
            }
            return (
              <li key={s.id}>
                <span className="n">{i + 1}</span>
                <button
                  type="button"
                  className="d tap"
                  onClick={() => setEditId(s.id)}
                  aria-label={`${i + 1}セット目を修正`}
                >
                  {describeSet(s)}
                </button>
                <span className="e">{v ? `e1RM ${formatKg(v)}` : "—"}</span>
                <button
                  type="button"
                  aria-label={`${i + 1}セット目を削除`}
                  onClick={async () => {
                    await deleteSet(s.id);
                    onLogged();
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
