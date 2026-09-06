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
import { readFileSync } from "node:fs";
import { e1rm, e1rmSeries, setE1rm } from "../src/lib/e1rm.ts";
import { estimateStartWeight, suggestNext } from "../src/lib/progression.ts";
import { aggregateVolume, judge, rangeFor, weekStart } from "../src/lib/volume.ts";
import { evaluateDeload } from "../src/lib/deload.ts";
import { TEMPLATES } from "../src/data/routineTemplates.ts";

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

/* ---------- ALG-2 ボリューム按分 ---------- */

const exercises = JSON.parse(readFileSync(new URL("../public/data/exercises.json", import.meta.url), "utf8"));
const muscles = JSON.parse(readFileSync(new URL("../public/data/muscles.json", import.meta.url), "utf8"));
const muscleGroups = JSON.parse(readFileSync(new URL("../public/data/muscleGroups.json", import.meta.url), "utf8"));

const mainSet = (exerciseId, at = Date.now()) => ({
  exerciseId, type: "main", unit: "weight_reps", weight: 60, reps: 8, rir: 1, loggedAt: at, sessionId: "s",
});
const vol = (sets) => {
  const rows = aggregateVolume(sets, exercises, muscles, muscleGroups, "intermediate");
  return Object.fromEntries(rows.map((r) => [r.group, r.sets]));
};

test("ALG-2: 要件定義書の例（ベンチ4セット → 胸4.0 / 肩2.0 / 三頭2.0）と一致する", () => {
  const v = vol(Array.from({ length: 4 }, () => mainSet("bench_press")));
  assert.equal(v["大胸筋"], 4);
  assert.equal(v["三角筋前部"], 2);
  assert.equal(v["上腕三頭筋"], 2);
});

test("ALG-2: 三頭は2つの頭を持つが、1セットの寄与は1筋群あたり最大1.0", () => {
  // 合計してしまうと外側頭0.5 + 内側頭0.5 = 1.0 になり、協働なのに主働と同じ量になる
  const v = vol([mainSet("bench_press")]);
  assert.equal(v["上腕三頭筋"], 0.5);
});

test("ALG-2: ウォームアップは集計しない", () => {
  const warm = { ...mainSet("bench_press"), type: "warmup" };
  assert.equal(vol([warm])["大胸筋"] ?? 0, 0);
});

test("ALG-2: 安定筋（係数0）はボリュームに入らない", () => {
  // ベントオーバーロウはハムストリングを安定筋として持つ
  const v = vol([mainSet("bent_over_row")]);
  assert.equal(v["ハムストリング"] ?? 0, 0);
  assert.equal(v["広背筋"], 1);
});

test("ALG-2: 複数種目が同じ筋群に積み上がる", () => {
  const v = vol([mainSet("bench_press"), mainSet("incline_press"), mainSet("cable_fly")]);
  assert.equal(v["大胸筋"], 3);
});

test("ALG-2: 判定は筋群あたりで行う（部位あたりだと筋群の多い部位が過多になる）", () => {
  // 足は4筋群を含む。部位で合算すると目安を超えるが、筋群ごとなら適正に収まる
  const legSets = [
    ...Array.from({ length: 8 }, () => mainSet("barbell_squat")),
    ...Array.from({ length: 7 }, () => mainSet("seated_leg_curl")),
    ...Array.from({ length: 4 }, () => mainSet("hip_thrust")),
    ...Array.from({ length: 7 }, () => mainSet("standing_calf_raise")),
  ];
  const rows = aggregateVolume(legSets, exercises, muscles, muscleGroups, "intermediate");
  const legs = rows.filter((r) => r.region === "legs");
  const total = legs.reduce((a, r) => a + r.sets, 0);
  assert.ok(total > 20, "部位合計では目安の上限を超える");
  for (const r of legs) {
    if (r.sets > 0) assert.notEqual(r.status, "high", `${r.group} が過多と判定された`);
  }
});

test("ALG-6: 目安レンジで不足・適正・過多を判定する", () => {
  assert.equal(judge(7, [8, 12]), "low");
  assert.equal(judge(8, [8, 12]), "ok");
  assert.equal(judge(12, [8, 12]), "ok");
  assert.equal(judge(13, [8, 12]), "high");
});

test("週の区切りは月曜0時起点", () => {
  const wed = new Date(2026, 8, 9, 15, 30).getTime(); // 水曜
  const mon = new Date(2026, 8, 7, 0, 0, 0, 0).getTime();
  assert.equal(weekStart(wed), mon);
});

test("週の区切り: 日曜は前の月曜に属する", () => {
  const sun = new Date(2026, 8, 13, 23, 0).getTime();
  const mon = new Date(2026, 8, 7, 0, 0, 0, 0).getTime();
  assert.equal(weekStart(sun), mon);
});

test("ALG-6: 筋群の定義が muscles.json と一致する", () => {
  const inMuscles = new Set(muscles.map((m) => m.group).filter(Boolean));
  const inGroups = new Set(muscleGroups.map((g) => g.name));
  assert.equal(inGroups.size, muscleGroups.length, "muscleGroups.json に重複がある");
  for (const g of inMuscles) assert.ok(inGroups.has(g), `${g} が muscleGroups.json に無い`);
  for (const g of inGroups) assert.ok(inMuscles.has(g), `${g} を持つ筋が無い`);
});

test("ALG-6: 補助的な筋群は主要筋群より低いレンジで判定する", () => {
  const p = rangeFor("primary", "intermediate");
  const s = rangeFor("supporting", "intermediate");
  assert.ok(s[0] < p[0] && s[1] < p[1]);
});

test("ALG-6: 多関節種目で常に働く筋群は supporting になっている", () => {
  const tier = Object.fromEntries(muscleGroups.map((g) => [g.name, g.tier]));
  for (const g of ["脊柱起立筋", "内転筋群", "前腕", "腹斜筋"]) {
    assert.equal(tier[g], "supporting", `${g} が supporting でない`);
  }
  for (const g of ["大胸筋", "広背筋", "大腿四頭筋", "三角筋中部"]) {
    assert.equal(tier[g], "primary", `${g} が primary でない`);
  }
});

/* ---------- ALG-4 デロード判定 ---------- */

const DAY = 86400000;
const NOW = Date.now();

/** 停滞かつRIR低下を再現する記録を作る */
function fatiguedHistory(exerciseId) {
  const sets = [];
  // 6週間前〜3週間前：同じ重量、余力あり（RIR 3）
  for (let i = 0; i < 3; i++) {
    const at = NOW - (40 - i * 5) * DAY;
    sets.push({ exerciseId, sessionId: `old${i}`, type: "main", unit: "weight_reps", weight: 100, reps: 5, rir: 3, loggedAt: at });
    sets.push({ exerciseId, sessionId: `old${i}`, type: "main", unit: "weight_reps", weight: 100, reps: 5, rir: 3, loggedAt: at + 60000 });
  }
  // 直近2週間：同じ重量なのに余力なし（RIR 1）＝疲労の兆候。ベスト更新もなし
  for (let i = 0; i < 3; i++) {
    const at = NOW - (12 - i * 5) * DAY;
    sets.push({ exerciseId, sessionId: `new${i}`, type: "main", unit: "weight_reps", weight: 100, reps: 5, rir: 1, loggedAt: at });
    sets.push({ exerciseId, sessionId: `new${i}`, type: "main", unit: "weight_reps", weight: 100, reps: 5, rir: 1, loggedAt: at + 60000 });
  }
  return sets;
}

test("ALG-4: 主要種目2つで停滞とRIR低下が揃えば提案する", () => {
  const m = new Map([
    ["bench_press", fatiguedHistory("bench_press")],
    ["barbell_squat", fatiguedHistory("barbell_squat")],
  ]);
  const v = evaluateDeload(m, exercises, NOW, null);
  assert.equal(v.suggest, true);
  assert.equal(v.flagged.length, 2);
});

test("ALG-4: 1種目だけなら提案しない", () => {
  const m = new Map([["bench_press", fatiguedHistory("bench_press")]]);
  assert.equal(evaluateDeload(m, exercises, NOW, null).suggest, false);
});

test("ALG-4: 単関節種目は対象外", () => {
  const m = new Map([
    ["cable_lateral_raise", fatiguedHistory("cable_lateral_raise")],
    ["ez_bar_curl", fatiguedHistory("ez_bar_curl")],
  ]);
  const v = evaluateDeload(m, exercises, NOW, null);
  assert.equal(v.suggest, false);
  assert.equal(v.flagged.length, 0);
});

test("ALG-4: 前回デロードから3週間以内は判定しない", () => {
  const m = new Map([
    ["bench_press", fatiguedHistory("bench_press")],
    ["barbell_squat", fatiguedHistory("barbell_squat")],
  ]);
  const v = evaluateDeload(m, exercises, NOW, NOW - 10 * DAY);
  assert.equal(v.suggest, false);
  assert.ok(v.reason.includes("あと"));
});

test("ALG-4: 記録が浅いうちは判定しない", () => {
  const few = fatiguedHistory("bench_press").slice(0, 4);
  const m = new Map([["bench_press", few], ["barbell_squat", few]]);
  assert.equal(evaluateDeload(m, exercises, NOW, null).suggest, false);
});

test("ALG-4: 伸びていればRIRが下がっていても提案しない", () => {
  const grow = (id) => fatiguedHistory(id).map((s, i) =>
    i >= 6 ? { ...s, weight: 110 } : s // 直近は重量が伸びている＝自己ベスト更新
  );
  const m = new Map([["bench_press", grow("bench_press")], ["barbell_squat", grow("barbell_squat")]]);
  assert.equal(evaluateDeload(m, exercises, NOW, null).suggest, false);
});

/* ---------- テンプレプログラムの配分 ---------- */

const UPPER = new Set(["shoulders", "biceps", "triceps", "forearms", "back", "chest"]);
const exById = new Map(exercises.map((e) => [e.id, e]));

/** 腹筋は上下どちらにも属さないので比率から外す */
function upperLower(routine) {
  let upper = 0;
  let lower = 0;
  for (const day of routine.days) {
    for (const item of day.items) {
      const ex = exById.get(item.exerciseId);
      if (!ex) throw new Error(`未知の種目 ${item.exerciseId}`);
      if (UPPER.has(ex.region)) upper += item.sets;
      else if (ex.region === "legs") lower += item.sets;
    }
  }
  return { upper, lower, ratio: upper / lower };
}

for (const tpl of TEMPLATES) {
  const routine = tpl.build();

  test(`${tpl.name}: 種目IDがすべて実在する`, () => {
    for (const day of routine.days) {
      for (const item of day.items) {
        assert.ok(exById.has(item.exerciseId), `未知の種目 ${item.exerciseId}`);
        assert.ok(item.sets >= 1 && item.sets <= 10, `セット数が範囲外 ${item.sets}`);
      }
    }
  });

  test(`${tpl.name}: 上半身と下半身のセット比が約2:1（1.8〜2.2）`, () => {
    const { upper, lower, ratio } = upperLower(routine);
    assert.ok(
      ratio >= 1.8 && ratio <= 2.2,
      `上${upper} : 下${lower} = ${ratio.toFixed(2)}:1（1.8〜2.2に収めること）`
    );
  });

  test(`${tpl.name}: 同じ曜日が重複しない`, () => {
    const dows = routine.days.map((d) => d.dayOfWeek);
    assert.equal(new Set(dows).size, dows.length);
  });
}

/* ---------- 結果 ---------- */

console.log("\nテンプレプログラムの上下比");
for (const tpl of TEMPLATES) {
  const { upper, lower, ratio } = upperLower(tpl.build());
  console.log(
    `  ${tpl.name.padEnd(16)} 上${String(upper).padStart(3)} : 下${String(lower).padStart(3)}  = ${ratio.toFixed(2)}:1`
  );
}
console.log("");

console.log(`${passed} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  x ${f}`);
  process.exit(1);
}
