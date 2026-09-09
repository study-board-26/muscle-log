import { useEffect, useState } from "react";
import { REGIONS, type Master } from "../data/master";
import { getAllSets, getSetting } from "../db";
import type { Experience } from "../lib/progression";
import { suggestNextRegions, type RegionSuggestion } from "../lib/nextTarget";

/**
 * FR-D5 次に鍛える部位の提案。
 *
 * 「今日は何をやるか」を決めるのは記録画面なので、今日のメニューの隣に置く。
 * 判断の根拠（何セット足りないか・何日空いたか）を必ず添える。
 * 数字を見せずに部位だけ出すと、正しいかどうかを利用者が確かめられない。
 */
export function NextTarget({ master }: { master: Master }) {
  const [items, setItems] = useState<RegionSuggestion[] | null>(null);
  // 既定は畳む。開くと「トレーニングを開始」が画面外へ押し出されるため
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [sets, exp] = await Promise.all([
        getAllSets(),
        getSetting<Experience>("experience"),
      ]);
      const out = suggestNextRegions(
        sets,
        master.exercises,
        master.muscles,
        master.muscleGroups,
        exp ?? "beginner"
      );
      if (alive) setItems(out);
    })();
    return () => {
      alive = false;
    };
  }, [master]);

  // 記録が無いうちは何も言えないので出さない
  if (!items || items.length === 0) return null;

  const label = (r: string) => REGIONS.find((x) => x.id === r)?.label ?? r;

  return (
    <section className="next-target">
      <header>
        <h2>次に鍛えるなら</h2>
        <span className="nt-note">直近7日の実績から</span>
      </header>

      <div className="nt-regions">
        {items.map((it, i) => (
          <span key={it.region} className={`nt-chip${i === 0 ? " lead" : ""}`}>
            {label(it.region)}
          </span>
        ))}
      </div>

      {/* 区切りは「／」。筋群名そのものに「・」を含むものがある（僧帽筋・菱形筋） */}
      <p className="nt-lead">{items.map((it) => it.lead).join("／")} が遅れています</p>

      <button type="button" className="nt-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "根拠を閉じる" : "根拠を見る"}
      </button>

      {open && (
        <>
          <ul className="nt-why">
            {items.map((it) => (
              <li key={it.region}>
                <b>{label(it.region)}</b>
                {it.reasons.map((r) => (
                  <span key={r}>{r}</span>
                ))}
              </li>
            ))}
          </ul>

          <p className="hint">
            週あたりの目安（ALG-6）に届いていない筋群と、間隔が空いている筋群から選んでいます。
            直近2日に鍛えた部位は回復を待つため出しません。目安であって処方ではありません。
          </p>
        </>
      )}
    </section>
  );
}
