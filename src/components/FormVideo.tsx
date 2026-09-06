import type { Exercise } from "../data/types";
import { PRIMARY_CHANNEL } from "../data/types";

/**
 * フォーム解説動画（FR-A2）。
 *
 * 動画IDはチャンネル内検索を実際に開いて確認した実在のものだけを持たせている。
 * 確認できなかった種目は url を null にして検索リンクに回す。
 * 実在しないURLを載せると、ジムで開いた瞬間に使えないことが分かるため。
 *
 * 動画は消えたり非公開になったりするので、特定できている種目にも
 * 検索リンクを併記して、リンク切れでも辿り着けるようにしてある。
 */

const MATCH_LABEL: Record<string, string> = {
  exact: "この種目の解説",
  related: "関連する解説",
};

function channelSearchUrl(query: string): string {
  return `https://www.youtube.com/${PRIMARY_CHANNEL.handle}/search?query=${encodeURIComponent(query)}`;
}

function webSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " フォーム 解説")}`;
}

export function FormVideo({ exercise }: { exercise: Exercise }) {
  const v = exercise.video;

  return (
    <section className="fv">
      {v.url ? (
        <a className="fv-main" href={v.url} target="_blank" rel="noreferrer">
          <span className="fv-play" aria-hidden="true">
            ▶
          </span>
          <span className="fv-body">
            <span className="fv-title">{v.title}</span>
            <span className="fv-meta">
              {v.channel}
              <span className={`fv-badge m-${v.match}`}>{MATCH_LABEL[v.match]}</span>
            </span>
          </span>
        </a>
      ) : (
        <p className="fv-none">
          この種目の解説動画は{PRIMARY_CHANNEL.name.replace(/【.*/, "")}さんのチャンネルで確認できませんでした。
          下から探してください。
        </p>
      )}

      <div className="fv-links">
        <a href={channelSearchUrl(v.query)} target="_blank" rel="noreferrer">
          チャンネル内で探す
        </a>
        <a href={webSearchUrl(v.query)} target="_blank" rel="noreferrer">
          他の解説を探す
        </a>
      </div>
    </section>
  );
}
