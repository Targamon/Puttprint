# ---- 1. build the React app ----
FROM node:22-slim AS app
WORKDIR /src/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# ---- 2. server + built app ----
FROM node:22-slim
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
WORKDIR /srv/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY server/public ./public
COPY --from=app /src/app/dist ./public/app
# course seed file the server reads at startup (path: ../../app/src/data/courses.json)
COPY app/src/data/courses.json /srv/app/src/data/courses.json
RUN mkdir -p /data
VOLUME /data
EXPOSE 8787
CMD ["npx", "tsx", "src/server.ts"]
