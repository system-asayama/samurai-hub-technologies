# samurai-hub-technologies

Docker + nginx 静的サイトのスタータテンプレート。

## 開発
```bash
docker build -t samurai-hub-technologies .
docker run -p 8080:80 samurai-hub-technologies
open http://localhost:8080
```

## デプロイ
このリポを本アプリの「環境別デプロイ設定」に追加し、
`main` ブランチに push すると自動デプロイされます。
