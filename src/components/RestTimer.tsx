import { useEffect, useRef, useState } from "react";
import { beep, formatMMSS } from "../lib/rest";

/**
 * FR-B4 レストタイマー
 *
 * 残り時間は「終了時刻との差」で毎回計算する。
 * setInterval のカウントダウンだと、画面消灯やバックグラウンド遷移で
 * タイマーが止まって狂うため（NFR-4）。
 */
export function RestTimer({
  endsAt,
  onDone,
  onDismiss,
  onExtend,
}: {
  endsAt: number;
  onDone: () => void;
  onDismiss: () => void;
  onExtend: (sec: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [endsAt]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 250);
    // 復帰時にすぐ正しい残り時間へ追いつかせる
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);

  const remainMs = endsAt - now;
  const remainSec = remainMs / 1000;
  const done = remainMs <= 0;

  useEffect(() => {
    if (done && !firedRef.current) {
      firedRef.current = true;
      beep();
      onDone();
    }
  }, [done, onDone]);

  return (
    <div className={`rest-bar${done ? " done" : ""}`} role="status">
      <div className="rest-main">
        <span className="rest-label">{done ? "レスト完了" : "レスト"}</span>
        <span className="rest-time">{formatMMSS(Math.max(0, remainSec))}</span>
      </div>
      <div className="rest-actions">
        {!done && (
          <button type="button" onClick={() => onExtend(30)}>
            +30秒
          </button>
        )}
        <button type="button" onClick={onDismiss}>
          {done ? "閉じる" : "スキップ"}
        </button>
      </div>
    </div>
  );
}
