/**
 * 写真の縮小（RISK-4 写真データの容量）
 *
 * iPhone の写真はそのままだと1枚数MBある。毎週撮って貯めると端末を圧迫し、
 * iOS にストレージ都合で消される確率も上がる（NFR-9 / RISK-6）。
 * 長辺1280pxのJPEGに落としてから保存する。体型の変化を見るには十分な解像度。
 */

const MAX_EDGE = 1280;
const QUALITY = 0.82;

export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function resizeImage(file: File): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像の変換に失敗しました");
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    if (!blob) throw new Error("画像の変換に失敗しました");
    return { blob, width: w, height: h };
  } finally {
    bitmap.close();
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** FR-C5 体重の7日移動平均。日々の変動を均して傾向を見る。 */
export function movingAverage(
  points: { date: number; weight: number }[],
  days = 7
): { date: number; value: number }[] {
  const span = days * 86400000;
  return points.map((p) => {
    const window = points.filter((q) => q.date <= p.date && q.date > p.date - span);
    const avg = window.reduce((a, q) => a + q.weight, 0) / window.length;
    return { date: p.date, value: avg };
  });
}
