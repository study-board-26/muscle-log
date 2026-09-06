/**
 * 解説動画のURLが実在し、公開されているかを確認する
 *
 *   npm run check:videos
 *
 * YouTube の oEmbed は、公開中の動画なら 200 とタイトル・チャンネル名を返し、
 * 存在しない・非公開・削除済みなら 4xx を返す。
 * 動画は消えることがあるので、定期的に流してリンク切れを見つける。
 *
 * ネットワークに依存するため、通常のビルドやCIには含めていない。
 */

import { readFileSync } from "node:fs";

const exercises = JSON.parse(
  readFileSync(new URL("../public/data/exercises.json", import.meta.url), "utf8")
);

const targets = exercises.filter((e) => e.video?.url);
console.log(`確認対象: ${targets.length} 件 / 全 ${exercises.length} 種目\n`);

let ok = 0;
const problems = [];

for (const ex of targets) {
  const api = `https://www.youtube.com/oembed?url=${encodeURIComponent(ex.video.url)}&format=json`;
  try {
    const res = await fetch(api);
    if (!res.ok) {
      problems.push(`${ex.code} ${ex.name}: HTTP ${res.status}  ${ex.video.url}`);
      continue;
    }
    const j = await res.json();
    const titleMatches = j.title === ex.video.title;
    const channelMatches = j.author_name === ex.video.channel;

    if (!channelMatches) {
      problems.push(
        `${ex.code} ${ex.name}: チャンネル不一致\n     期待 ${ex.video.channel}\n     実際 ${j.author_name}`
      );
    } else if (!titleMatches) {
      // タイトルは投稿者が変更しうるので、実際の値に合わせる必要があることを知らせる
      problems.push(
        `${ex.code} ${ex.name}: タイトル不一致\n     保存 ${ex.video.title}\n     実際 ${j.title}`
      );
    } else {
      ok++;
    }
  } catch (e) {
    problems.push(`${ex.code} ${ex.name}: 取得失敗 ${e.message}`);
  }
}

console.log(`一致: ${ok} / ${targets.length}`);
if (problems.length) {
  console.log(`\n要確認 ${problems.length}件`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
console.log("\nすべて実在し、タイトルとチャンネルも一致しました。");
