import { useEffect, useState } from "react";
import type { Master } from "../data/master";
import { dayLabel } from "../data/routineTemplates";
import { getPreviousSets, getProgression, type RoutineRec } from "../db";
import { formatKg } from "../lib/e1rm";
import { suggestNext } from "../lib/progression";

/**
 * FR-E1 今日のメニュー
 *
 * ジムに着いてから種目を探す手間をなくすのが目的なので、
 * 種目名だけでなく提案重量まで出してしまう。
 */

export interface MenuRow {
  exerciseId: string;
  code: string;
  name: string;
  targetSets: number;
  weight: number | null;
  target: number;
  unit: string;
}

export function todayIndex(routine: RoutineRec, at = Date.now()): number {
  return routine.days.findIndex((d) => d.dayOfWeek === new Date(at).getDay());
}

export function useTodayMenu(master: Master, routine: RoutineRec | null) {
  const [rows, setRows] = useState<MenuRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!routine) {
        setRows(null);
        return;
      }
      const di = todayIndex(routine);
      if (di < 0) {
        setRows([]);
        return;
      }
      const out: MenuRow[] = [];
      for (const item of routine.days[di].items) {
        const ex = master.exercises.find((e) => e.id === item.exerciseId);
        if (!ex) continue;
        const [prev, state] = await Promise.all([
          getPreviousSets(ex.id, null),
          getProgression(ex.id),
        ]);
        const s = suggestNext(ex, prev?.sets ?? [], state);
        out.push({
          exerciseId: ex.id,
          code: ex.code,
          name: ex.name,
          targetSets: item.sets,
          weight: s.weight,
          target: s.target,
          unit: ex.unit === "weight_seconds" ? "秒" : "回",
        });
      }
      if (alive) setRows(out);
    })();
    return () => {
      alive = false;
    };
  }, [master, routine]);

  return rows;
}

export function TodayMenu({
  master,
  routine,
  onOpenRoutine,
}: {
  master: Master;
  routine: RoutineRec | null;
  onOpenRoutine: () => void;
}) {
  const rows = useTodayMenu(master, routine);

  if (!routine) {
    return (
      <section className="today">
        <header className="today-head">
          <h2>今日のメニュー</h2>
          <button type="button" onClick={onOpenRoutine}>
            ルーティンを選ぶ
          </button>
        </header>
        <p className="hint">
          分割法を選ぶと、曜日ごとの種目と提案重量がここに出ます。毎回種目を探す必要がなくなります。
        </p>
      </section>
    );
  }

  const di = todayIndex(routine);
  const day = di >= 0 ? routine.days[di] : null;

  return (
    <section className="today">
      <header className="today-head">
        <h2>
          今日のメニュー
          {day && <span className="today-label">{day.label}</span>}
        </h2>
        <button type="button" onClick={onOpenRoutine}>
          編集
        </button>
      </header>

      {!day ? (
        <p className="hint">
          {routine.name}：今日（{dayLabel(new Date().getDay())}）は休養日です。
          やる場合は「トレーニングを開始」から種目を選べます。
        </p>
      ) : rows === null ? (
        <p className="hint">読み込み中…</p>
      ) : (
        <ul className="today-list">
          {rows.map((r) => (
            <li key={r.exerciseId}>
              <span className="card-code">{r.code}</span>
              <span className="tm-name">{r.name}</span>
              <span className="tm-plan">
                {r.weight !== null ? (
                  <>
                    {formatKg(r.weight)}kg × {r.target}
                    {r.unit}
                  </>
                ) : (
                  <span className="tm-first">初回</span>
                )}
                <small>{r.targetSets}セット</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
