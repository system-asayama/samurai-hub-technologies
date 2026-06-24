# Samurai Hub Technologies

システム開発・Web制作を手がける個人事業のコーポレートサイト。
**コーポレートサイト + ブログ + 実績 + 管理画面** を備えた Node.js (Express) アプリです。

## 機能
- 公開サイト（トップ / ブログ一覧・詳細 / 実績一覧・詳細）
- 管理者ログイン（`/admin`）
- ブログ記事の作成・編集・削除（Markdown対応・下書き/公開）
- 実績の作成・編集・削除（タグ・関連URL・カバー画像）

## 構成
```
server.js          # Express アプリ本体（ルーティング）
src/
  store.js         # JSONファイルによるデータ永続化
  auth.js          # 管理者認証（単一ユーザー）
  markdown.js      # Markdown → HTML
views/             # EJS テンプレート（公開ページ + admin/）
public/            # 静的アセット（styles.css / admin.css / main.js）
Dockerfile         # node:20-alpine ベース
```

## ローカル開発
```bash
npm install
DATA_DIR=./data ADMIN_PASSWORD=yourpass SESSION_SECRET=dev npm run dev
# http://localhost:8084  /  管理画面: http://localhost:8084/admin
```

## 環境変数
| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `PORT` | 待ち受けポート | `8084` |
| `DATA_DIR` | データ保存先 | `/data` |
| `ADMIN_USERNAME` | 管理者ユーザー名 | `admin` |
| `ADMIN_PASSWORD` | 管理者パスワード（**本番で必須**） | `changeme123`（警告表示） |
| `ADMIN_PASSWORD_HASH` | bcryptハッシュ（指定時は上記より優先） | — |
| `SESSION_SECRET` | セッション署名鍵（**本番で必須**） | 起動毎にランダム生成 |

## デプロイ（本番）
`main` ブランチへ push すると、`.github/workflows/deploy.yml` が
SSH 経由でサーバー上の Docker を再ビルド・再起動します（ポート `8084`）。

### 初回に必要な設定（GitHub リポジトリの Secrets）
管理画面を安全に使うため、以下の Secrets を登録してください
（**Settings → Secrets and variables → Actions**）。未設定でも起動はしますが、
初期パスードのまま警告が出ます。

- `ADMIN_USERNAME` … 管理者ユーザー名
- `ADMIN_PASSWORD` … 管理者パスワード
- `SESSION_SECRET` … ランダムな長い文字列（例: `openssl rand -hex 32`）

### データ永続化
記事・実績は **ホストの `~/apps/samurai-hub-technologies-data`** に保存され、
コンテナへ `/data` としてマウントされます（再デプロイしても消えません）。

> 注意: `deploy.yml` は環境追加時に自動生成されたものに、上記の
> ボリュームマウントと環境変数注入を追記しています。デプロイ設定を
> 再生成した場合は、この2点（`-v` と `-e`）の再追記が必要です。
