# R&D運営診断プラットフォーム / 5C巡検プラットフォーム

`Next.js + React + Lark Base OpenAPI` で構築した、5C評価と是正クローズドループの Web アプリです。

## 1. 実装済み機能
- `SVダッシュボード`：担当店舗、最近評価、未対応課題、期限超過、報告済み未確認を一覧化
- `5C評価開始`：段階入力型 UI。`最低遵守項目` が `22 / 22 OK` でない限り後続評価に進めません
- `是正管理`：SV / 店舗の共通画面。役割によって見えるデータ範囲と操作を切り替え
- `マイ 5C`：店舗向けに最低遵守、運営基準、価値創造、推移、未完了の是正項目を表示
- `是正報告`：店舗が改善内容と改善後写真を提出し、SV が完了確認
- `デュアルモード`：Demo は脱敏 Mock データ、本番は Lark OAuth 2.0 + `user_access_token`

## 2. 接続対象 Base
- Base 名：`【最新】5C管理`
- Base Token：`RADabvBDpavPzFsMmIHj7KOxpXc`
- `店舗関連表`：`tblKmUWvhrg8v1n0`
- `最低遵守項目`：`tblVQA4TkDmBAImb`
- `運営基準項目`：`tbldp5mMzD6BRkuj`
- `価値創造項目`：`tblq0BeYXTzhCqcs`
- `問題指摘`：`tblatoQ7jqgteyQP`
- `評価項目マスター`：`tblQJcMuzwota38S`

## 3. 重要な業務制約
- `最低遵守項目` は前提 Gate であり、通常の採点画面ではありません
- `最低遵守項目` が `22 / 22 OK` でない場合、`運営基準項目` と `価値創造項目` へ進めず、必ず `問題指摘` を起票します
- `最低遵守点数 = 22 項目中 OK 件数`
- `運営基準点数 = 50 項目中 OK 件数`
- `価値創造点数 = 20 項目中 OK 件数`
- `店舗マスター` の集計点数フィールドには直接書き込みません
- 本番モードでは明細評価テーブルと `問題指摘` にのみ書き込み、集計は Base の数式に委ねます
- 是正フィードバックの一期実装は `問題指摘` 拡張方式を採用しています

## 4. ローカル起動
### 4.1 依存関係のインストール
```bash
npm install
```

### 4.2 開発サーバー起動
```bash
npm run dev
```

### 4.3 ビルド確認
```bash
npm run check
```

アクセス先：
- `http://localhost:3000/`

## 5. Demo モード
- トップページから `Demo SV に入る` または `Demo 店舗に入る` を選択
- Demo はメモリ上の Mock データのみを使用し、本番 Base には一切書き込みません
- Demo でも以下のクローズドループを体験できます
  - SV が評価を開始
  - 最低遵守が `22 / 22` 未満の場合に是正起票
  - 店舗が是正報告を提出
  - SV が是正完了を確認

## 6. 本番モード接続
### 6.1 環境変数
`.env.example` を参照してください。

### 6.2 Lark OAuth 設定
- Lark 開発者コンソールでアプリを作成
- `redirect_uri` を以下に設定
  - `http://localhost:3000/api/auth/lark/callback`
  - または本番ドメイン配下の同一パス
- 少なくとも以下の権限を申請してください
  - `bitable:app:readonly`
  - `bitable:app`
  - `contact:user.base:readonly`
  - `offline_access`

### 6.3 権限制御
- フロントエンドは `app_secret` を保持しません
- フロントエンドは Base を直接呼び出しません
- サーバーサイドが `user_access_token` を用いて Lark OpenAPI を呼び出します
- SV / 店舗のデータ範囲は Base の実権限を継承しつつ、サーバー側でマッピングフィールドを用いて再収束します

## 7. アカウントマッピング要件
本番モードで `SV` / `店舗` を安全に判定するため、`店舗マスター` に最低限以下のフィールドを持たせることを推奨します。
- `SVユーザーID`
- `店舗ユーザーID`

これにより Lark ログインユーザーを以下へ安全に紐付けられます。
- SV が閲覧可能な店舗集合
- 店舗が閲覧可能な単店舗範囲

## 8. schema 取り扱い
- コードには、確定済みのテーブル ID・主要フィールド ID・業務制約を反映済みです
- 未認証環境で schema を捏造しないため、22 / 50 / 20 項目の完全 field mapping は production JSON に分離しています
- 本番ログイン後に `GET /api/schema` を呼ぶと、対象テーブルの最新フィールド一覧を取得できます
- 本番用の完全マッピングは `src/config/production/` に分離しました
  - `base-schema-manifest.production.json`
  - `minimum-checklist.production.json`
  - `operation-checklist.production.json`
  - `value-checklist.production.json`
- 22 / 50 / 20 の JSON ひな型生成は以下で再実行できます

```bash
npm run generate:production-checklists
```

- 本番モードでは `minimum-checklist.production.json` / `operation-checklist.production.json` / `value-checklist.production.json` の未解決プレースホルダが残っていると、リポジトリ初期化時に明示的にエラーにします
- つまり Demo はそのまま動作し、本番だけが「実 Base に紐付いた完全マッピング」を要求する構成です

## 9. ディレクトリ構成
- `src/app`：ルーティングと API Route
- `src/components`：ダッシュボード、評価ウィザード、是正管理、チャート
- `src/lib/auth`：Demo セッション、Lark OAuth
- `src/lib/repositories`：Demo / 本番のデータアクセス実装
- `src/lib/demo-data.ts`：脱敏済み Demo データ

## 10. 主要ページ
- `/sv/dashboard`
- `/sv/audits/new`
- `/tasks`
- `/store/my-5c`

## 11. 参照ドキュメント
- PRD：`.trae/documents/5c-lark-prd.md`
- 技術設計：`.trae/documents/5c-lark-technical-architecture.md`
