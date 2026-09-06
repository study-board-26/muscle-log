import type { Exercise } from "../data/types";
import { PRIMARY_CHANNEL } from "../data/types";

/**
 * フォーム解説動画（FR-A2）。
 *
 * 採用基準は「その種目のフォームを解説していること」。
 * 種目選びの話（ティアリストや部位別ベスト3）は基準を満たさないので採らない。
 *
 * 動画IDは推測していない。YouTube検索を実際に開いて確認した実在のものだけを
 * 持たせ、npm run check:videos が oEmbed で全件の存在を照合する。
 * 実在しないURLを載せると、ジムで開いた瞬間に使えないことが分かるため。
 *
 * 動画は消えたり改題されたりするので、検索リンクも併記して
 * リンク切れでも辿り着けるようにしてある。
 */

function channelSearchUrl(query: string): string {
  return `https://www.youtube.com/${PRIMARY_CHANNEL.handle}/search?query=${encodeURIComponent(query)}`;
}

function webSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} フォーム 解説`)}`;
}

export function FormVideo({ exercise }: { exercise: Exercise }) {
  const v = exercise.video;

  return (
    <section className="fv">
      <a className="fv-main" href={v.url} target="_blank" rel="noreferrer">
        <span className="fv-play" aria-hidden="true">
          ▶
        </span>
        <span className="fv-body">
          <span className="fv-title">{v.title}</span>
          <span className="fv-meta">{v.channel}</span>
        </span>
      </a>

      <div className="fv-links">
        <a href={channelSearchUrl(v.query)} target="_blank" rel="noreferrer">
          今古賀翔の動画を探す
        </a>
        <a href={webSearchUrl(v.query)} target="_blank" rel="noreferrer">
          他の解説を探す
        </a>
      </div>
    </section>
  );
}
