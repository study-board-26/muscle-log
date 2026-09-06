/**
 * ALG-1 / ALG-3 / ALG-5 の検証
 *
 *   npm test
 *
 * これらのロジックは提案重量を直接決めるため、UIを介さずに検証する。
 * lib/e1rm.ts と lib/progression.ts は型以外の import を持たないので、
 * Node の型ストリッピングでそのまま読み込める。
 */

import assert from "node:assert/strict";
import { e1rm, e1rmSeries, setE1rm } from "../src/lib/e1rm.ts";
import { estimateStartWeight, suggestNext } from "../src/lib/progression.ts";

let passed = 0;
const fails = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    fails.push(`${name}\n    ${e.message.split("\n")[0]}`);
  }
}

const round1 = (v) => Math.round(v * 10) / 10;

/* ---------- ALG-1 e1RM ---------- */

test("e1RM: 80kg×8 RIR2 は 106.7kg", () => {
  assert.equal(round1(e1rm(80, 8, 2)), 106.7);
});

test("e1RM: RIR0 のほうが同レップでも低く出る", () => {
  assert.ok(e1rm(80, 8, 0) < e1rm(80, 8, 2));
});

test("e1RM: 有効レップが12を超えたら除外する", () => {
  assert.equal(e1rm(50, 12, 1), null); // 13
  assert.notEqual(e1rm(50, 10, 2), null); // 12
});

test("e1RM: ウォームアップは集計しない", () => {
  const warm = { unit: "weight_reps", type: "warmup", weight: 60, reps: 8, rir: 3 };
  assert.equal(setE1rm(warm), null);
});

test("e1RM: 秒数種目は算出しない", () => {
  const hold = { unit: "weight_seconds", type: "main", weight: 30, reps: null, seconds: 45, rir: 0 };
  assert.equal(setE1rm(hold), null);
});

test("e1RM推移: セッションごとの最良値を取り、自己ベスト更新に印を付ける", () => {
  const s = (sessionId, at, weight, reps) => ({
    sessionId, loggedAt: at, unit: "weight_reps", type: "main", weight, reps, rir: 0,
  });
  const pts = e1rmSeries([
    s("a", 1, 60, 8),
    s("a", 2, 62, 8), // セッションa の最良
    s("b", 3, 61, 8), // 更新せず
    s("c", 4, 70, 8), // 更新
  ]);
  assert.equal(pts.length, 3);
  assert.deepEqual(pts.map((p) => p.isBest), [true, false, true]);
});

/* ---------- ALG-3 次回重量の提案 ---------- */

const bench = {
  id: "bench_press",
  unit: "weight_reps",
  repRange: [5, 10],
  progressionStepKg: 2.5,
  strengthCoefficient: { beginner: 0.5, intermediate: 0.75, advanced: 1.25 },
};

const mk = (weight, reps, rir) => ({
  type: "main", unit: "weight_reps", weight, reps, seconds: null, rir,
});

test("ALG-3 条件A: 全セット上限到達かつ平均RIR<=1 なら +2.5kg で下限に戻す", () => {
  const s = suggestNext(bench, [mk(60, 10, 1), mk(60, 10, 1), mk(60, 10, 0)], undefined);
  assert.equal(s.kind, "up");
  assert.equal(s.weight, 62.5);
  assert.equal(s.target, 5);
});

test("ALG-3 条件A: 上限到達でもRIRに余裕があれば上げない", () => {
  const s = suggestNext(bench, [mk(60, 10, 3), mk(60, 10, 3)], undefined);
  assert.equal(s.kind, "hold");
});

test("ALG-3 条件B: 下限は満たすが上限未満なら据え置きで+1回狙い", () => {
  const s = suggestNext(bench, [mk(60, 8, 1), mk(60, 7, 1)], undefined);
  assert.equal(s.kind, "hold");
  assert.equal(s.weight, 60);
  assert.equal(s.target, 9);
});

test("ALG-3 条件B: 目標は上限を超えない", () => {
  const s = suggestNext(bench, [mk(60, 10, 2), mk(60, 9, 2)], undefined);
  assert.equal(s.target, 10);
});

test("ALG-3 条件C: 初回の未達は据え置き、失敗回数を1にする", () => {
  const s = suggestNext(bench, [mk(60, 4, 0), mk(60, 3, 0)], undefined);
  assert.equal(s.kind, "hold");
  assert.equal(s.consecutiveFailures, 1);
});

test("ALG-3 条件C: 2回連続の未達で10%落として失敗回数をリセット", () => {
  const state = { exerciseId: "bench_press", currentWeight: 60, currentRepTarget: 5, consecutiveFailures: 1, lastDeloadAt: null, updatedAt: 0 };
  const s = suggestNext(bench, [mk(60, 4, 0)], state);
  assert.equal(s.kind, "down");
  assert.equal(s.weight, 54); // 60 * 0.9
  assert.equal(s.consecutiveFailures, 0);
});

test("ALG-3: 履歴が無ければ初回として扱う", () => {
  const s = suggestNext(bench, [], undefined);
  assert.equal(s.kind, "first");
  assert.equal(s.weight, null);
});

test("ALG-3: ウォームアップだけの履歴は初回扱い", () => {
  const warm = { type: "warmup", unit: "weight_reps", weight: 40, reps: 10, seconds: null, rir: 5 };
  assert.equal(suggestNext(bench, [warm], undefined).kind, "first");
});

test("ALG-3: 加重できない種目は上げずに難易度で進める", () => {
  const roller = { id: "ab_rollout", unit: "weight_reps", repRange: [8, 12], progressionStepKg: 0 };
  const s = suggestNext(roller, [mk(0, 12, 0), mk(0, 12, 1)], undefined);
  assert.equal(s.kind, "hold");
  assert.ok(s.reason.includes("難易度"));
});

test("ALG-3: 秒数種目は秒でも同じ判定になる", () => {
  const hold = { id: "heavy_hold", unit: "weight_seconds", repRange: [30, 60], progressionStepKg: 2 };
  const sec = (w, s2, rir) => ({ type: "main", unit: "weight_seconds", weight: w, reps: null, seconds: s2, rir });
  const s = suggestNext(hold, [sec(30, 60, 0), sec(30, 60, 1)], undefined);
  assert.equal(s.kind, "up");
  assert.equal(s.weight, 32);
  assert.ok(s.reason.includes("秒"));
});

test("ALG-3: 重量は履歴中の最大値を基準にする", () => {
  const s = suggestNext(bench, [mk(60, 10, 0), mk(65, 10, 1)], undefined);
  assert.equal(s.weight, 67.5);
});

/* ---------- ALG-5 初回開始重量 ---------- */

test("ALG-5: 体重比から開始重量を出す（安全側に10%引く）", () => {
  const r = estimateStartWeight(bench, 74.5, "intermediate");
  // 74.5 * 0.75 = 55.875 → repFactor(5)=0.857 → 47.9 → ×0.9 = 43.1 → 43
  assert.equal(r.weight, 43);
});

test("ALG-5: 経験レベルが上がると重くなる", () => {
  const b = estimateStartWeight(bench, 70, "beginner").weight;
  const a = estimateStartWeight(bench, 70, "advanced").weight;
  assert.ok(a > b);
});

test("ALG-5: 係数が無い種目では推定しない", () => {
  const curl = { id: "ez_bar_curl", unit: "weight_reps", repRange: [6, 10], progressionStepKg: 2.5 };
  assert.equal(estimateStartWeight(curl, 70, "beginner"), null);
});

test("ALG-5: 体重未入力なら推定しない", () => {
  assert.equal(estimateStartWeight(bench, 0, "beginner"), null);
});

/* ---------- 結果 ---------- */

console.log(`${passed} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  x ${f}`);
  process.exit(1);
}
