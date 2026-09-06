import { useCallback, useEffect, useRef, useState } from "react";
import {
  addPhoto,
  deleteBodyWeight,
  deletePhoto,
  listBodyWeights,
  listPhotos,
  putBodyWeight,
  setSetting,
  type BodyWeightRec,
  type PhotoRec,
  type Pose,
} from "../db";
import { Stepper } from "../components/Stepper";
import { formatBytes, movingAverage, resizeImage } from "../lib/photo";
import { formatKg } from "../lib/e1rm";

const POSES: { id: Pose; label: string }[] = [
  { id: "front", label: "正面" },
  { id: "back", label: "背面" },
  { id: "side", label: "横" },
];

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 体重の推移。生値の点と7日移動平均の線を重ねる（FR-C5）。 */
function WeightChart({ rows }: { rows: BodyWeightRec[] }) {
  if (rows.length < 2) {
    return <p className="hint">2日以上記録すると推移が出ます。</p>;
  }

  const w = 300;
  const h = 90;
  const pad = 8;
  const avg = movingAverage(rows);

  const xs = rows.map((r) => r.date);
  const ys = [...rows.map((r) => r.weight), ...avg.map((a) => a.value)];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const spanX = x1 - x0 || 1;
  const spanY = y1 - y0 || 1;

  const px = (v: number) => pad + ((v - x0) / spanX) * (w - pad * 2);
  const py = (v: number) => h - pad - ((v - y0) / spanY) * (h - pad * 2);

  const line = avg
    .map((a, i) => `${i === 0 ? "M" : "L"}${px(a.date).toFixed(1)},${py(a.value).toFixed(1)}`)
    .join(" ");

  return (
    <>
      <svg className="wchart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="体重の推移">
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
        {rows.map((r) => (
          <circle key={r.id} cx={px(r.date)} cy={py(r.weight)} r="1.8" fill="var(--ink-3)" />
        ))}
      </svg>
      <p className="hint">
        点が実測、線が7日移動平均。{formatKg(y0)}〜{formatKg(y1)}kg
      </p>
    </>
  );
}

export function Body() {
  const [weights, setWeights] = useState<BodyWeightRec[] | null>(null);
  const [photos, setPhotos] = useState<PhotoRec[] | null>(null);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [weight, setWeight] = useState(70);
  const [pose, setPose] = useState<Pose>("front");
  const [compare, setCompare] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const [w, p] = await Promise.all([listBodyWeights(), listPhotos()]);
    setWeights(w);
    setPhotos(p);
    if (w.length > 0) setWeight(w[w.length - 1].weight);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Blob URL は使い終わったら必ず解放する。放置するとメモリを持っていく。
  useEffect(() => {
    if (!photos) return;
    const map = new Map<string, string>();
    for (const p of photos) map.set(p.id, URL.createObjectURL(p.blob));
    setUrls(map);
    return () => {
      for (const u of map.values()) URL.revokeObjectURL(u);
    };
  }, [photos]);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const { blob, width, height } = await resizeImage(file);
      await addPhoto(blob, pose, width, height);
      await load();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleCompare = (id: string) => {
    setCompare((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-2)
    );
  };

  if (!weights || !photos) {
    return (
      <main className="state">
        <p>読み込み中…</p>
      </main>
    );
  }

  const latest = weights[weights.length - 1];
  const samePose = photos.filter((p) => p.pose === pose);
  const picked = compare
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is PhotoRec => Boolean(p));
  const totalBytes = photos.reduce((a, p) => a + p.blob.size, 0);

  return (
    <main className="body-log">
      {/* ---- 体重（FR-B5） ---- */}
      <section className="vol">
        <header className="vol-head">
          <h2>体重</h2>
          {latest && (
            <span className="hint">
              最新 {formatKg(latest.weight)}kg（{fmtDate(latest.date)}）
            </span>
          )}
        </header>

        <Stepper label="今日の体重" unit="kg" value={weight} step={0.1} min={30} max={200} onChange={setWeight} />

        <button
          type="button"
          className="log-btn"
          onClick={async () => {
            await putBodyWeight(weight);
            // 初回重量の推定（ALG-5）でも同じ値を使う
            await setSetting("bodyWeightKg", weight);
            await load();
          }}
        >
          体重を記録
        </button>
        <p className="hint">同じ日に何度記録しても、その日の最後の値が残ります。</p>

        <WeightChart rows={weights} />

        {weights.length > 0 && (
          <ul className="wlist">
            {[...weights].reverse().slice(0, 8).map((r) => (
              <li key={r.id}>
                <span className="d">{fmtDate(r.date)}</span>
                <span className="v">{formatKg(r.weight)} kg</span>
                <button
                  type="button"
                  aria-label={`${fmtDate(r.date)}の体重を削除`}
                  onClick={async () => {
                    await deleteBodyWeight(r.id);
                    await load();
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- 写真（FR-B6） ---- */}
      <section className="vol">
        <header className="vol-head">
          <h2>体の写真</h2>
          <span className="hint">{photos.length}枚 / {formatBytes(totalBytes)}</span>
        </header>

        <div className="rir">
          <span className="stepper-label">ポーズ</span>
          <div className="rir-row pose-row">
            {POSES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={p.id === pose ? "on" : ""}
                onClick={() => {
                  setPose(p.id);
                  setCompare([]);
                }}
                aria-pressed={p.id === pose}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
        <button
          type="button"
          className="log-btn"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "保存しています…" : `${POSES.find((p) => p.id === pose)?.label}の写真を追加`}
        </button>
        <p className="hint">
          写真は端末内にのみ保存され、外部へは送信されません。長辺1280pxに縮小して保存します。
        </p>

        {picked.length === 2 && (
          <div className="compare">
            {picked
              .slice()
              .sort((a, b) => a.date - b.date)
              .map((p) => (
                <figure key={p.id}>
                  <img src={urls.get(p.id)} alt={`${fmtDate(p.date)}の写真`} />
                  <figcaption>{fmtDate(p.date)}</figcaption>
                </figure>
              ))}
          </div>
        )}

        {samePose.length === 0 ? (
          <p className="hint">まだ写真がありません。</p>
        ) : (
          <>
            <p className="hint">
              2枚選ぶと並べて比較できます。
              {compare.length === 1 && "（もう1枚選んでください）"}
            </p>
            <div className="ptimeline">
              {samePose.map((p) => (
                <div key={p.id} className={`pcell${compare.includes(p.id) ? " on" : ""}`}>
                  <button type="button" onClick={() => toggleCompare(p.id)}>
                    <img src={urls.get(p.id)} alt={`${fmtDate(p.date)}の写真`} />
                    <span>{fmtDate(p.date)}</span>
                  </button>
                  <button
                    type="button"
                    className="pdel"
                    aria-label={`${fmtDate(p.date)}の写真を削除`}
                    onClick={async () => {
                      await deletePhoto(p.id);
                      setCompare((c) => c.filter((x) => x !== p.id));
                      await load();
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
