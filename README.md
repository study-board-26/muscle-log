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
npm run validate   # 種目マスタの整合性チェック
npm run icons      # PWAアイコンの生成
npm run build      # 本番ビルド
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
scripts/         整合性チェック、アイコン生成
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

Phase 1 の途中。種目マスタと配信経路が整い、記録機能はこれから実装する。

- [x] 要件定義（v1.1）
- [x] 種目選定 32種目（Phase 1 は20種目）
- [x] 種目マスタのデータ化と検証
- [x] PWA の配信経路
- [ ] セット記録・前回値表示・レストタイマー
- [ ] e1RM と次回重量の提案
- [ ] 3D表示
