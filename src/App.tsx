import { useEffect, useMemo, useState } from "react";
import { loadMaster, type Master } from "./data/master";
import { Exercises } from "./screens/Exercises";
import { Analysis } from "./screens/Analysis";
import { Settings } from "./screens/Settings";
import { Workout } from "./screens/Workout";

type Tab = "workout" | "exercises" | "progress" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "workout", label: "記録" },
  { id: "exercises", label: "種目" },
  { id: "progress", label: "分析" },
  { id: "settings", label: "設定" },
];

/**
 * iOS Safari は、ホーム画面に追加していないサイトの保存データを
 * 7日間の未使用で削除する。記録が消えるため、追加を促す（NFR-9）。
 */
function useStandalone(): boolean {
  return useMemo(() => {
    const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone;
    return window.matchMedia("(display-mode: standalone)").matches || ios === true;
  }, []);
}

function InstallNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside className="notice">
      <p className="notice-title">ホーム画面に追加してください</p>
      <p>
        このまま Safari で使うと、<b>7日間開かないと記録が消えます</b>。
        共有ボタンから「ホーム画面に追加」を選ぶと、データが保持されます。
      </p>
      <button type="button" onClick={() => setDismissed(true)}>
        閉じる
      </button>
    </aside>
  );
}

export default function App() {
  const [master, setMaster] = useState<Master | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("workout");
  const standalone = useStandalone();

  useEffect(() => {
    loadMaster()
      .then(setMaster)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main className="state">
        <p className="err">{error}</p>
      </main>
    );
  }
  if (!master) {
    return (
      <main className="state">
        <p>読み込んでいます…</p>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="app-head">
        <h1>筋トレ記録</h1>
        <p className="sub">
          {tab === "exercises"
            ? `種目 ${master.exercises.length}　筋 ${master.muscles.length}　文献 ${master.references.length}`
            : TABS.find((t) => t.id === tab)?.label}
        </p>
      </header>

      <div className="app-body">
        {!standalone && <InstallNotice />}
        {tab === "workout" && <Workout master={master} />}
        {tab === "exercises" && <Exercises master={master} />}
        {tab === "progress" && <Analysis master={master} />}
        {tab === "settings" && <Settings />}
      </div>

      {/* 親指の届く画面下部に主要導線を置く（NFR-3） */}
      <nav className="bottom-nav" aria-label="画面切り替え">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? "on" : ""}
            onClick={() => setTab(t.id)}
            aria-current={t.id === tab ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
