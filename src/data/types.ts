/**
 * 種目マスタの型定義
 *
 * 要件定義書 v1.0 のデータモデル（Muscle / Exercise / ExerciseMuscle）に対応する。
 * 実データは muscles.json / exercises.json / references.json に置き、
 * アプリ本体とは分離して配信する（NFR-8）。
 */

/** 部位。ボリューム集計（ALG-2）とヒートマップ（FR-C3）の単位でもある。 */
export type Region =
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "back"
  | "chest"
  | "legs";

/** 種目におけるその筋の役割。ボリュームの按分係数を決める（ALG-2）。 */
export type MuscleRole = "prime" | "secondary" | "stabilizer";

/**
 * 根拠の強さ。種目詳細画面に表示する（FR-A9）。
 * intervention: 筋量を直接測定した縦断研究。左右差デザインを含む。
 * meta:         メタ分析・システマティックレビュー。
 * emg:          急性の筋電図研究。肥大の予測因子としては未検証（ref 1）。
 * principle:    確立された原則からの演繹。直接の比較研究は未確認。
 */
export type EvidenceLevel = "intervention" | "meta" | "emg" | "principle";

/** 記録単位。FA-4 のような等尺性種目は秒数で記録する（FR-B2 の拡張）。 */
export type LogUnit = "weight_reps" | "weight_seconds";

export type Equipment =
  | "barbell"
  | "ez_bar"
  | "dumbbell"
  | "cable"
  | "machine"
  | "smith"
  | "bench"
  | "rack"
  | "ab_roller"
  | "bodyweight";

/**
 * フォーム解説動画。
 *
 * 条件は「その種目のフォームを解説していること」。
 * 第一候補は今古賀翔だが、その種目のフォーム解説が無い場合は
 * 他のフォーム解説チャンネルから採る。種目選びの話（ティアリストや
 * 部位別ベスト3）はフォーム解説ではないので採用しない。
 */
export interface ExerciseVideo {
  url: string;
  title: string;
  channel: string;
  /** チャンネル内検索・一般検索の両方に使うキーワード */
  query: string;
}

/** 第一候補のチャンネル。「チャンネル内で探す」の遷移先になる。 */
export const PRIMARY_CHANNEL = {
  name: "今古賀翔【トレーニング科学】",
  handle: "@ShoImakoga",
} as const;

export interface Muscle {
  id: string;
  nameJa: string;
  nameEn: string;
  region: Region;
  /**
   * ボリューム判定の単位となる筋群。頭ごとに分かれている筋はまとめる
   * （上腕三頭筋の3頭など）。三角筋は前部・中部・後部を別々に鍛えるので分ける。
   * null は肥大の対象として数えない筋（回旋筋腱板、腹横筋、腸腰筋）。
   */
  group: string | null;
  /** 3Dモデルのメッシュノード名（3Dは廃止したため現在は未使用）。 */
  meshNodeId: string;
}

export interface ExerciseMuscle {
  muscleId: string;
  role: MuscleRole;
  /**
   * ボリューム按分係数（ALG-2）。既定は prime 1.0 / secondary 0.5 / stabilizer 0。
   * 種目ごとの実態に合わせて上書きできる（RISK-3 への対応）。
   */
  coefficient: number;
}

export interface Evidence {
  level: EvidenceLevel;
  /** references.json の id。 */
  refs: string[];
  /** 種目詳細画面に表示する1〜2文の要約。 */
  summary: string;
}

export interface Exercise {
  id: string;
  /** 種目選定書での通し番号（S-1, BI-1 …）。 */
  code: string;
  name: string;
  nameEn: string;
  region: Region;
  equipment: Equipment[];
  /** 器具が空いていない場合の代替種目名（表示用）。 */
  alternatives: string[];
  unit: LogUnit;
  /** [下限, 上限]。ダブルプログレッションの目標レップ帯（ALG-3）。 */
  repRange: [number, number];
  /** 1段階の増量幅（kg）。ALG-3 の条件A で使う。unit が weight_seconds の場合も同様。 */
  progressionStepKg: number;
  muscles: ExerciseMuscle[];
  evidence: Evidence;
  /** 効かせるコツ。3D上のホットスポット注釈にも流用する（FR-A4）。 */
  cues: string[];
  /** よくある失敗。NGフォーム比較アニメの元になる（FR-A5）。 */
  commonErrors: string[];
  /**
   * 姿勢を誤ると効果が大きく落ちる種目に付ける警告。
   * 3D上でも強調表示する（LG-2 の座位、LG-4 の立位など）。
   */
  criticalNote: string | null;
  /**
   * e1RM推移を1本の線として繋ぐ種目（FR-C1）。
   * 例: ラットプルダウン → チンニング。
   */
  equivalentTo: string[];
  phase: 1 | 2 | 3;
  /** 3Dアニメーションクリップの識別子。アセット制作時に確定する。 */
  modelAssetId: string;
  /**
   * 多関節種目か。デロード判定（ALG-4）は主要種目のみを対象にする。
   * 単関節の補助種目は疲労の指標として当てにならないため。
   */
  compound: boolean;
  /** フォーム解説動画。FR-A2 の代替として、実際の動画で動作を示す。 */
  video: ExerciseVideo;
  /**
   * ALG-5 の種目係数（体重比）。初回の開始重量を当たり付けするためだけに使う。
   * 公開されている一般的なストレングス基準を丸めた目安で、
   * 基準が確立している少数の種目にのみ設定する（OPEN-3）。
   */
  strengthCoefficient?: {
    beginner: number;
    intermediate: number;
    advanced: number;
  };
}

export interface Reference {
  id: string;
  citation: string;
  url: string;
  /** 一次研究か解説記事かを区別する。 */
  kind: "intervention" | "meta" | "emg" | "methodology" | "review_article";
  year: number;
}

/** ALG-2 の既定係数。 */
export const DEFAULT_COEFFICIENT: Record<MuscleRole, number> = {
  prime: 1.0,
  secondary: 0.5,
  stabilizer: 0.0,
};

/** ALG-6 の週間ボリューム目安レンジ（部位あたりのセット数）。 */
export const WEEKLY_VOLUME_RANGE: Record<"beginner" | "intermediate", [number, number]> = {
  beginner: [8, 12],
  intermediate: [12, 20],
};
