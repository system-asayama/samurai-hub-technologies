FROM node:20-alpine

WORKDIR /app

# 依存だけ先に入れてレイヤーキャッシュを効かせる
COPY package*.json ./
RUN npm ci --omit=dev

# アプリ本体
COPY . .

# データ永続化ディレクトリ（本番ではホストのボリュームをマウントする）
ENV DATA_DIR=/data
RUN mkdir -p /data
VOLUME ["/data"]

ENV NODE_ENV=production
ENV PORT=8084
EXPOSE 8084

CMD ["node", "server.js"]
