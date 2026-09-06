/**
 * PWA アイコンの生成
 *
 *   npm run icons
 *
 * 外部依存を持たせたくないので、Node 標準の zlib だけで PNG を書き出す。
 * 図案はバーベル（バー＋内外のプレート）。iOS はアイコンを角丸にマスクするため、
 * 図形は中央 60% の安全領域に収める。
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const BG = [0x11, 0x16, 0x1a]; // --ground（ダーク）
const FG = [0x74, 0xaa, 0xe8]; // --accent

// --- CRC32 ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  // 10-12: compression / filter / interlace = 0
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** バーベルの図案。x, y は 0..1 に正規化した座標で判定する。 */
function isForeground(x, y) {
  const cy = Math.abs(y - 0.5);

  // バー本体
  if (x > 0.2 && x < 0.8 && cy < 0.035) return true;

  const cx = Math.abs(x - 0.5);
  // 内側プレート（大）
  if (cx > 0.26 && cx < 0.325 && cy < 0.23) return true;
  // 外側プレート（小）
  if (cx > 0.345 && cx < 0.395 && cy < 0.15) return true;

  return false;
}

function render(size) {
  // 各行の先頭にフィルタバイト(0)を置く
  const rowBytes = size * 3 + 1;
  const buf = Buffer.alloc(rowBytes * size);

  for (let py = 0; py < size; py++) {
    const rowStart = py * rowBytes;
    buf[rowStart] = 0;
    const y = (py + 0.5) / size;
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size;
      const c = isForeground(x, y) ? FG : BG;
      const i = rowStart + 1 + px * 3;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
    }
  }
  return png(size, buf);
}

mkdirSync(outDir, { recursive: true });
for (const size of [192, 512, 180]) {
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  const file = join(outDir, name);
  writeFileSync(file, render(size));
  console.log(`${name}  ${size}x${size}`);
}
console.log("\n出力先:", outDir);
