# muscle-log

記録から次に扱う重量が決まるトレーニングアプリ。
どの筋にどう効かせるかを3Dで確認し、実測データから次回の負荷を提案する。

iPhone の Safari で動作する PWA として配信する。

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/requirements.html](docs/requirements.html) | 要件定義書 v1.1 |
| [docs/exercise-selection.html](docs/exercise-selection.html) | 種目選定書（8部位32種目、エビデンス付き） |
| [docs/data-master.md](docs/data-master.md) | 種目マスタの設計メモ |

## 開発

```bash
npm install
npm run dev        # 開発サーバ
npm test           # 重量提案アルゴリズムの検証（21件）
npm run validate   # 種目マスタの整合性チェック
npm run icons      # PWAアイコンの生成
npm run build      # validate + test + 型チェック + 本番ビルド
```

Node.js 24 以上が必要。**開発マシンにのみ必要で、利用するiPhone側には何も要らない。**

### 実機で確認する

```bash
npm run dev -- --host
```

同じWi-Fi内のiPhoneから `http://<PCのIP>:5173/muscle-log/` で開ける。
ただし **Service Worker は HTTPS でないと登録されない**ため、
オフライン動作とホーム画面追加の確認は GitHub Pages にデプロイして行う。

## 構成

```
public/data/     種目マスタ（JSON）。実行時にfetchする
src/data/        型定義とマスタのローダ
src/db/          IndexedDB。記録は端末内にのみ保存する
src/lib/         e1RM（ALG-1）、重量提案（ALG-3/ALG-5）、レストタイマー
src/screens/     記録・種目・推移・設定
src/components/  入力ステッパー、レストタイマー、種目選択
scripts/         整合性チェック、アルゴリズム検証、アイコン生成
docs/            要件定義書・種目選定書
.github/workflows/deploy.yml   main への push で GitHub Pages へ自動デプロイ
```

種目マスタを `public/` に置いてビルドに含めないのは、
**アプリを再ビルドせずに種目を追加できるようにするため**（要件 `NFR-8`）。
Service Worker がキャッシュするのでオフラインでも読める。

## 重要な制約

iOS Safari は、**ホーム画面に追加していないサイトの保存データを7日間の未使用で削除する**。
記録アプリとして致命的なため、ホーム画面への追加を利用条件とし、
未追加の状態では警告を表示する（要件 `NFR-9` / `RISK-6`）。

## 現在の状態

Phase 1 のコアループ（記録 → 分析 → 提案）が動作する。

- [x] 要件定義（v1.1）
- [x] 種目選定 32種目（Phase 1 は20種目）
- [x] 種目マスタのデータ化と検証
- [x] PWA の配信経路
- [x] セット記録・前回値表示・レストタイマー
- [x] e1RM の算出と推移（ALG-1）
- [x] 次回重量の提案（ALG-3 / 初回は ALG-5）
- [ ] 部位別ボリューム集計とヒートマップ
- [ ] デロード提案（ALG-4）
- [ ] 3D表示

### 重量提案の考え方

2回目以降は必ず実測ベース（ALG-3 ダブルプログレッション）で提案する。
体格からの推定（ALG-5）は精度に限界があるため、未実施の種目の初回にのみ使い、
推定値であることを画面上に明示する。
