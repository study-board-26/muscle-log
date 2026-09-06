import type { Exercise, Muscle, Reference, Region } from "./types";

export interface Master {
  muscles: Muscle[];
  exercises: Exercise[];
  references: Reference[];
  /** muscleId から筋を引くための索引 */
  muscleById: Map<string, Muscle>;
  /** refId から文献を引くための索引 */
  referenceById: Map<string, Reference>;
}

/**
 * 種目マスタは public/data に置き、実行時に fetch する。
 * アプリを再ビルドせずに種目を追加できるようにするため（NFR-8）。
 * Service Worker がキャッシュするのでオフラインでも読める（NFR-1）。
 */
async function fetchJson<T>(file: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}data/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`種目マスタの読み込みに失敗しました (${file}: ${res.status})`);
  }
  return (await res.json()) as T;
}

export async function loadMaster(): Promise<Master> {
  const [muscles, exercises, references] = await Promise.all([
    fetchJson<Muscle[]>("muscles.json"),
    fetchJson<Exercise[]>("exercises.json"),
    fetchJson<Reference[]>("references.json"),
  ]);

  return {
    muscles,
    exercises,
    references,
    muscleById: new Map(muscles.map((m) => [m.id, m])),
    referenceById: new Map(references.map((r) => [r.id, r])),
  };
}

export const REGIONS: { id: Region; label: string }[] = [
  { id: "shoulders", label: "肩" },
  { id: "biceps", label: "二頭" },
  { id: "triceps", label: "三頭" },
  { id: "forearms", label: "前腕" },
  { id: "abs", label: "腹筋" },
  { id: "back", label: "背中" },
  { id: "chest", label: "胸" },
  { id: "legs", label: "足" },
];

export const EVIDENCE_LABEL: Record<string, string> = {
  intervention: "介入研究",
  meta: "メタ分析",
  emg: "EMG",
  principle: "原則",
};

export const EQUIPMENT_LABEL: Record<string, string> = {
  barbell: "バーベル",
  ez_bar: "EZバー",
  dumbbell: "ダンベル",
  cable: "ケーブル",
  machine: "マシン",
  smith: "スミス",
  bench: "ベンチ",
  rack: "ラック",
  ab_roller: "アブローラー",
  bodyweight: "自重",
};

export const ROLE_LABEL: Record<string, string> = {
  prime: "主働",
  secondary: "協働",
  stabilizer: "安定",
};
