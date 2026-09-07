/**
 * 下部タブのアイコン。
 *
 * 外部のアイコンフォントやライブラリは使わずインラインSVGで持つ。
 * オフライン動作（NFR-1）を壊さず、初期表示のJS（NFR-2）も増やさないため。
 * 線は currentColor なので、選択中の色替えはCSS側だけで済む。
 */

export type TabIconName = "workout" | "exercises" | "progress" | "body" | "settings";

/** 24x24 のグリッドに、線幅1.8で描く。塗りは端点の丸だけに使う。 */
const PATHS: Record<TabIconName, React.ReactNode> = {
  // ダンベル：記録するのはトレーニングそのもの
  workout: (
    <>
      <path d="M7.5 12h9" />
      <rect x="5" y="8.5" width="2.5" height="7" rx="1" />
      <rect x="16.5" y="8.5" width="2.5" height="7" rx="1" />
      <path d="M3.5 10v4M20.5 10v4" />
    </>
  ),
  // 人のかたち：どの筋に効くかを引く画面
  exercises: (
    <>
      <circle cx="12" cy="4.6" r="2.3" />
      <path d="M12 7.2v6.6" />
      <path d="M7.2 9.9 12 8.4l4.8 1.5" />
      <path d="m7.2 9.9-.9 4.8M16.8 9.9l.9 4.8" />
      <path d="m12 13.8-2.5 6.8M12 13.8l2.5 6.8" />
    </>
  ),
  // 折れ線：e1RMとボリュームの推移
  progress: (
    <>
      <path d="M4 4v15.2a.8.8 0 0 0 .8.8H20" />
      <path d="m7.2 15.4 3.6-4.8 3 2.6 4.6-6" />
      <circle cx="18.4" cy="7.2" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  // カメラ：体の写真を残す画面。人型にすると「種目」と紛らわしいので避ける
  body: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.6" />
      <path d="M8.6 7 10 4.8h4l1.4 2.2" />
      <circle cx="12" cy="13.4" r="3.4" />
    </>
  ),
  // スライダー：設定
  settings: (
    <>
      <path d="M4 7.6h4.4M13.6 7.6H20" />
      <circle cx="11" cy="7.6" r="2.2" />
      <path d="M4 16.4h8.4M17.6 16.4H20" />
      <circle cx="15" cy="16.4" r="2.2" />
    </>
  ),
};

export function TabIcon({ name }: { name: TabIconName }) {
  return (
    <svg
      className="tab-icon"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
