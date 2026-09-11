FROM oven/bun:1.4.0-debian AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun ci

COPY . .
RUN bun run build
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.0-debian AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV WEB_DIST_DIR=/app/public
ENV SCORE_DB_PATH=/data/db.sqlite

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/server ./dist/server
COPY --from=build /app/apps/web/dist ./public
COPY package.json ./

RUN mkdir -p /data && chown -R bun:bun /app /data
USER bun

EXPOSE 8080
CMD ["bun", "dist/server/index.js"]
