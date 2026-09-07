import { useEffect, useState } from "react";
import { exportAll, getSetting, setSetting } from "../db";
import { EXPERIENCE_LABEL, type Experience } from "../lib/progression";
import { Stepper } from "../components/Stepper";

/** ホーム画面に追加済みか（NFR-9） */
function isStandalone(): boolean {
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || ios === true;
}

export function Settings() {
  const [bodyWeight, setBodyWeight] = useState(70);
  const [experience, setExperience] = useState<Experience>("beginner");
  const [loaded, setLoaded] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [bw, exp] = await Promise.all([
        getSetting<number>("bodyWeightKg"),
        getSetting<Experience>("experience"),
      ]);
      if (bw) setBodyWeight(bw);
      if (exp) setExperience(exp);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void setSetting("bodyWeightKg", bodyWeight);
  }, [bodyWeight, loaded]);

  useEffect(() => {
    if (!loaded) return;
    void setSetting("experience", experience);
  }, [experience, loaded]);

  const standalone = isStandalone();

  return (
    <main className="settings">
      <section className="block">
        <h2>プロフィール</h2>
        <p className="hint">
          未実施の種目の開始重量を当たり付けするために使います（ALG-5）。
          2回目以降は実測の記録から提案するので、この値は使いません。
        </p>
        <Stepper
          label="体重"
          unit="kg"
          value={bodyWeight}
          step={0.5}
          min={30}
          max={200}
          onChange={setBodyWeight}
        />
        <div className="rir">
          <span className="stepper-label">筋トレ歴</span>
          <div className="exp-row">
            {(Object.keys(EXPERIENCE_LABEL) as Experience[]).map((e) => (
              <button
                key={e}
                type="button"
                className={e === experience ? "on" : ""}
                onClick={() => setExperience(e)}
                aria-pressed={e === experience}
              >
                {EXPERIENCE_LABEL[e]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="block">
        <h2>データ</h2>
        <p className="hint">
          記録は端末内にのみ保存され、外部へは送信されません。
          {standalone
            ? "ホーム画面に追加済みなので、データは保持されます。"
            : "ホーム画面に未追加のため、7日間開かないと iOS がデータを削除します。"}
        </p>
        <button
          type="button"
          className="sub-btn"
          onClick={async () => setExported(await exportAll())}
        >
          全記録を書き出す
        </button>
        {exported && (
          <>
            <p className="hint">
              下のテキストを選択してコピーし、メモアプリなどに保存してください。
            </p>
            <textarea className="export" readOnly value={exported} rows={10} />
          </>
        )}
      </section>

      <section className="block">
        <h2>このアプリについて</h2>
        <p className="hint">
          種目は8部位32種目。選定根拠は種目一覧の各種目に表示しています。
          重量の提案はダブルプログレッション（ALG-3）に基づく目安であり、
          医療・指導上の助言ではありません。体調に応じてご自身で判断してください。
        </p>
      </section>
    </main>
  );
}
