/**
 * iOS の「ショートカット」App 経由で、本物のタイマーを起動する。
 *
 * アプリ内のレストタイマー（FR-B4）は、画面を消すか他のアプリに切り替えると
 * AudioContext も setInterval も止まるため、完了時に音が鳴らない。
 * ポケットに入れて休憩すると気づけない。
 *
 * 「時計」App のタイマーを Web から直接叩く公開スキームは存在しないので、
 * ショートカット App の run-shortcut スキームを踏み台にする。
 * これなら端末標準のタイマーが動くので、ロック中でも鳴る。
 *
 * x-callback-url で戻す実装にはしていない。x-success に渡せるのは https URL で、
 * それを開くと（ホーム画面のアプリではなく）Safari 側が開く。iOS ではこの2つで
 * ストレージが別なので、記録の入っていない空のアプリに着地して混乱する。
 * スキームで遷移するとiOSが左上に「◀ 筋トレ記録」を出すので、戻りはそれを使う。
 */

/** 設定に保存するショートカット名のキー。未設定なら機能ごと出さない。 */
export const SHORTCUT_NAME_KEY = "iosShortcutName";

/** 設定画面の入力欄に出す例。手順の説明と揃えている。 */
export const SHORTCUT_NAME_EXAMPLE = "レスト";

/**
 * 秒数をテキスト入力として渡す。ショートカット側は
 * 「タイマーを開始」の時間に［ショートカットの入力］を指定しておく。
 * 入力を使わず固定2分にしてある場合でも、余計な引数として無視されるだけ。
 */
export function shortcutUrl(name: string, seconds: number): string {
  const sec = Math.max(1, Math.round(seconds));
  return (
    "shortcuts://run-shortcut" +
    `?name=${encodeURIComponent(name.trim())}` +
    "&input=text" +
    `&text=${sec}`
  );
}

/**
 * ショートカットを起動する。名前が違えばショートカット App 側が
 * エラーを出すので、こちらでは握りつぶさずそのまま遷移させる。
 */
export function runShortcut(name: string, seconds: number): void {
  if (!name.trim()) return;
  window.location.href = shortcutUrl(name, seconds);
}
