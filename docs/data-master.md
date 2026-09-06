# 種目マスタ

要件定義書 `FR-A1`（種目マスタ）の実データ。アプリ本体とは分離して配信し、
アプリを更新せずに種目を追加できる構造とする（`NFR-8`）。

## ファイル

| ファイル | 内容 |
|---|---|
| `types.ts` | 型定義。アプリ側からはこれを import する |
| `muscles.json` | 筋 34件。3Dモデルのメッシュノードと1対1で対応させる |
| `exercises.json` | 種目 32件。8部位 × 4種目 |
| `references.json` | 参考文献 21件 |
| `validate.mjs` | 整合性チェック。`node data/validate.mjs` |

選定の経緯と根拠は `docs/exercise-selection.html` を参照。

## 検証

```bash
node data/validate.mjs
```

参照整合性（筋ID・文献ID・equivalentTo）、按分係数と役割の一致、部位あたりの件数、
Phase 1 の件数を検証する。エラーがあれば exit code 1 で終了するので、CIに組み込める。

現在の状態: 筋34 / 種目32 / 文献21、各部位4種目、Phase 1 が20種目。
根拠の内訳は 介入研究8・EMG11・原則13。

## 設計上の要点

### ボリューム按分（`ALG-2`）

`muscles[].coefficient` は既定で prime 1.0 / secondary 0.5 / stabilizer 0.0。
種目ごとに上書きできる構造にしてある（`RISK-3` への対応）。
握力や体幹の関与など「働いているが集計に入れたくない筋」は stabilizer（係数0）として記録する。

### 記録単位

`unit` は既定 `weight_reps`。`heavy_hold`（FA-4）のみ `weight_seconds` で、
このとき `repRange` は秒数を意味する。UI側で入力欄の単位を切り替えること。

### 漸進幅（`ALG-3`）

`progressionStepKg` はダブルプログレッションの条件Aを満たしたときの増量幅。
バーベル上半身2.5 / 下半身5.0 / ダンベル2.0（片手）/ ケーブル単関節1.25 を基準にした。

`ab_rollout`（AB-3）のみ 0。加重手段がなく、膝つき→立位という難易度で漸進するため、
重量提案の対象外として扱う。

### 根拠の強さ（`FR-A9` 提案中）

`evidence.level` は `intervention` > `meta` > `emg` > `principle` の順に強い。
急性のEMG振幅は筋肥大の予測因子として妥当性が検証されていない（文献 r1）ため、
EMGのみを根拠とする種目を介入研究と同列に見せてはいけない。
種目詳細画面ではこのレベルを明示すること。

### 姿勢の警告

`criticalNote` が入っている種目は、姿勢を誤ると効果が大きく落ちる。
特に `seated_leg_curl`（座位でなければならない）と `standing_calf_raise`（立位でなければならない）は、
介入研究で2〜15倍の差が出ている。3D上でも強調表示する。

### e1RM の連続性

`lat_pulldown`（BK-1）はラットプルダウンから懸垂へ移行する運用。
同一種目として記録し、懸垂時は「体重＋加重」を重量として入力することで
e1RM推移を1本の線として繋ぐ（`FR-C1`）。
`equivalentTo` は将来、別IDの種目同士を等価として扱う場合に使う（現在は全て空）。

## 未確定

- `meshNodeId` と `modelAssetId` は命名規則のみ。3Dアセット確定時に実体と紐づける（`OPEN-2`）
- 女性向け・体重階級別のストレングス基準は未整備（`OPEN-3`）
