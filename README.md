# Samurai Hub Technologies

システム開発・Web制作を手がける個人事業のコーポレートサイト。
**コーポレートサイト + ブログ + 実績 + 管理画面** を備えた Node.js (Express) アプリです。

## 機能
- 公開サイト（トップ / ブログ一覧・詳細 / 実績一覧・詳細）
- 管理画面ログイン（`/admin`）／**複数ユーザー対応**
- ユーザー管理（追加・パスワード変更・削除、権限: 管理者 / 編集者）
- ブログ記事の作成・編集・削除（Markdown対応・下書き/公開・投稿者表示）
- 実績の作成・編集・削除（タグ・関連URL・カバー画像・投稿者表示）

### 権限（ロール）
- **管理者 (admin)**: 記事・実績の編集に加え、ユーザーの追加・削除ができる
- **編集者 (editor)**: 記事・実績の投稿・編集のみ

複数人で運用する場合は、最初の管理者でログイン後、`/admin/users` から
メンバーを追加してください。各メンバーは自分のユーザー名・パスワードでログインします。

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
| `ADMIN_USERNAME` | 初回起動時に作成する最初の管理者名 | `admin` |
| `ADMIN_PASSWORD` | 同・初期パスワード（**本番で必須**） | `changeme123`（警告表示） |
| `SESSION_SECRET` | セッション署名鍵（**本番で必須**） | 起動毎にランダム生成 |

> `ADMIN_USERNAME` / `ADMIN_PASSWORD` は **ユーザーが0人のときだけ** 最初の管理者を作るために使われます。
> 以降のユーザー追加・パスワード変更は管理画面（`/admin/users`）で行い、データに保存されます。

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
