/**
 * 種目マスタの整合性チェック
 *
 *   npm run validate
 *
 * 参照整合性・按分係数・件数・Phase配分を検証する。
 * CIに組み込むことを想定し、エラーがあれば exit code 1 で終了する。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "public", "data");
const read = (f) => JSON.parse(readFileSync(join(dataDir, f), "utf8"));

const muscles = read("muscles.json");
const exercises = read("exercises.json");
const references = read("references.json");

const REGIONS = ["shoulders", "biceps", "triceps", "forearms", "abs", "back", "chest", "legs"];
const ROLES = ["prime", "secondary", "stabilizer"];
const EVIDENCE_LEVELS = ["intervention", "meta", "emg", "principle"];
const UNITS = ["weight_reps", "weight_seconds"];
const DEFAULT_COEFFICIENT = { prime: 1.0, secondary: 0.5, stabilizer: 0.0 };

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const muscleIds = new Set(muscles.map((m) => m.id));
const refIds = new Set(references.map((r) => r.id));
const exerciseIds = new Set(exercises.map((e) => e.id));

// --- 筋 ---
if (muscleIds.size !== muscles.length) fail("muscles.json: id が重複している");
for (const m of muscles) {
  if (!REGIONS.includes(m.region)) fail(`muscle ${m.id}: 未知の region "${m.region}"`);
  if (!m.meshNodeId) fail(`muscle ${m.id}: meshNodeId が空`);
}

// --- 種目 ---
if (exerciseIds.size !== exercises.length) fail("exercises.json: id が重複している");
const codes = new Set();

for (const ex of exercises) {
  const at = `${ex.code} (${ex.id})`;

  if (codes.has(ex.code)) fail(`${at}: code が重複している`);
  codes.add(ex.code);

  if (!REGIONS.includes(ex.region)) fail(`${at}: 未知の region "${ex.region}"`);
  if (!UNITS.includes(ex.unit)) fail(`${at}: 未知の unit "${ex.unit}"`);
  if (!EVIDENCE_LEVELS.includes(ex.evidence.level)) {
    fail(`${at}: 未知の evidence.level "${ex.evidence.level}"`);
  }
  if (!ex.evidence.summary) fail(`${at}: evidence.summary が空`);

  // レップ帯
  const [lo, hi] = ex.repRange;
  if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo < hi)) {
    fail(`${at}: repRange が不正 [${lo}, ${hi}]`);
  }

  // 参照整合性
  for (const r of ex.evidence.refs) {
    if (!refIds.has(r)) fail(`${at}: 存在しない参考文献 "${r}"`);
  }
  for (const eq of ex.equivalentTo) {
    if (!exerciseIds.has(eq)) fail(`${at}: equivalentTo が存在しない種目 "${eq}"`);
  }

  // 筋の割り当て
  const seen = new Set();
  let primeCount = 0;
  for (const em of ex.muscles) {
    if (!muscleIds.has(em.muscleId)) fail(`${at}: 存在しない筋 "${em.muscleId}"`);
    if (seen.has(em.muscleId)) fail(`${at}: 筋 "${em.muscleId}" が重複している`);
    seen.add(em.muscleId);

    if (!ROLES.includes(em.role)) fail(`${at}: 未知の role "${em.role}"`);
    if (em.role === "prime") primeCount++;

    const def = DEFAULT_COEFFICIENT[em.role];
    if (em.coefficient !== def) {
      warn(`${at}: ${em.muscleId} の係数 ${em.coefficient} が既定値 ${def} と異なる（意図的なら可）`);
    }
  }
  if (primeCount === 0) fail(`${at}: 主働筋 (prime) が1つもない`);

  // 主働筋はその種目の region に属しているべき
  const primeRegions = new Set(
    ex.muscles
      .filter((em) => em.role === "prime")
      .map((em) => muscles.find((m) => m.id === em.muscleId)?.region)
  );
  if (!primeRegions.has(ex.region)) {
    fail(`${at}: region "${ex.region}" に属する主働筋がない（主働筋の部位: ${[...primeRegions].join(", ")}）`);
  }

  // 漸進幅
  if (ex.progressionStepKg === 0 && !ex.criticalNote) {
    warn(`${at}: progressionStepKg が 0 だが criticalNote に理由がない`);
  }

  if (!ex.modelAssetId) fail(`${at}: modelAssetId が空`);
  if (![1, 2, 3].includes(ex.phase)) fail(`${at}: 未知の phase "${ex.phase}"`);

  // フォーム解説動画
  const v = ex.video;
  if (!v) {
    fail(`${at}: video が無い`);
  } else {
    if (!["exact", "related", "search"].includes(v.match)) {
      fail(`${at}: 未知の video.match "${v.match}"`);
    }
    if (!v.query) fail(`${at}: video.query が空（検索リンクが作れない）`);

    if (v.match === "search") {
      // 動画を特定できていないものは url を持たせない。
      // 中途半端なURLを載せるとジムで開いたときに使えないため。
      if (v.url) fail(`${at}: match が search なのに url がある`);
    } else {
      if (!v.url) fail(`${at}: match が ${v.match} なのに url が無い`);
      else if (!/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(v.url)) {
        fail(`${at}: video.url の形式が不正 "${v.url}"`);
      }
      if (!v.title) fail(`${at}: video.title が空`);
      if (!v.channel) fail(`${at}: video.channel が空`);
    }
  }

  if (typeof ex.compound !== "boolean") fail(`${at}: compound が真偽値でない`);
}

// --- 件数 ---
for (const region of REGIONS) {
  const n = exercises.filter((e) => e.region === region).length;
  if (n !== 4) fail(`region "${region}": ${n}種目（4種目であるべき）`);
}
if (exercises.length !== 32) fail(`種目数 ${exercises.length}（32であるべき）`);

const phase1 = exercises.filter((e) => e.phase === 1).length;
if (phase1 !== 20) fail(`Phase 1 の種目数 ${phase1}（20であるべき）`);

// --- 未使用の参考文献 ---
const usedRefs = new Set(exercises.flatMap((e) => e.evidence.refs));
for (const r of refIds) {
  if (!usedRefs.has(r)) warn(`参考文献 "${r}" がどの種目からも参照されていない`);
}

// --- 出力 ---
console.log(`筋: ${muscles.length}  種目: ${exercises.length}  文献: ${references.length}`);
console.log(
  REGIONS.map((r) => `${r}:${exercises.filter((e) => e.region === r).length}`).join("  ")
);
console.log(
  `Phase 1: ${phase1}  Phase 2: ${exercises.filter((e) => e.phase === 2).length}  ` +
    `Phase 3: ${exercises.filter((e) => e.phase === 3).length}`
);
const levels = EVIDENCE_LEVELS.map(
  (l) => `${l}:${exercises.filter((e) => e.evidence.level === l).length}`
);
console.log(`根拠の内訳  ${levels.join("  ")}`);

const vm = ["exact", "related", "search"].map(
  (m) => `${m}:${exercises.filter((e) => e.video?.match === m).length}`
);
console.log(`解説動画    ${vm.join("  ")}`);

if (warnings.length) {
  console.log(`\n警告 ${warnings.length}件`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log(`\nエラー ${errors.length}件`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log("\nOK");
