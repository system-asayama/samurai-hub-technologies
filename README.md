# Samurai Hub Technologies

システム開発・Web制作を手がける個人事業のコーポレートサイト。
Docker + nginx で配信する静的サイトです。

## 構成
```
public/
  index.html   # トップページ（1カラムのLP構成）
  styles.css   # スタイル
  main.js      # モバイルメニュー等
Dockerfile     # nginx:alpine ベース
default.conf   # nginx 設定
```

## 開発
```bash
docker build -t samurai-hub-technologies .
docker run -p 8080:8084 samurai-hub-technologies
open http://localhost:8080
```

`public/` 以下を編集するだけで内容を更新できます（ビルド工程なし）。

## カスタマイズ
- **お問い合わせフォーム**: `public/index.html` の `<form>` の `action` を
  実際のフォーム送信先（[Formspree](https://formspree.io/) 等）に差し替えてください。
  未設定でも、メール (`system.asayama@gmail.com`) への導線は機能します。
- **料金・サービス内容**: 各セクションのテキストを直接編集してください。

## デプロイ
このリポを本アプリの「環境別デプロイ設定」に追加し、
`main` ブランチに push すると自動デプロイされます。
