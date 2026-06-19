# crowsnest server image. Single-stage (one `npm ci`) for build reliability; image size isn't a
# concern for a local daemon. Built + run via docker/docker-compose.yml (`npm run up`).
FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 8787
# restart:unless-stopped in compose relaunches this on exit, so the /v1/restart button recovers.
CMD ["node", "dist/index.js"]
