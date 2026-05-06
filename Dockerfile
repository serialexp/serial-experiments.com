# syntax=docker/dockerfile:1.7
#
# serial-experiments.com — multi-stage build.
#
# Builder: Node + pnpm to run vite (client + ssr) + tsc. Bun *would* work
# for the build too, but the Vite plugin ecosystem is still primarily tested
# under Node and pnpm gives us reproducible installs from the lockfile.
#
# Runtime: Bun. The server (server.ts) opens bun:sqlite, parses multipart
# uploads via Bun's FormData, hashes passwords via Bun.password — all of
# which would need extra deps under Node. The compiled `dist/server` SSR
# bundle runs equally well under either.
#
# Volume: /app/data. Holds `site.db` (+ WAL/SHM) and `uploads/`. Portainer
# mounts a named volume here in prod.

FROM node:22-bookworm-slim AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /src
COPY package.json pnpm-lock.yaml ./
# Install with NODE_ENV unset so devDependencies (vite, typescript, sharp)
# are available. Pinning to the lockfile keeps the build reproducible.
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

# We only need the runtime artifacts — the SSR bundle, the server entry,
# the server-side modules, and the migration files. node_modules is not
# copied: server.ts only depends on Bun's built-ins.
COPY --from=builder /src/dist ./dist
COPY --from=builder /src/server.ts ./server.ts
COPY --from=builder /src/server ./server
COPY --from=builder /src/migrations ./migrations
# package.json kept so `bun run` resolves the entry script consistently
# and so any future runtime-only dep can be reinstalled here.
COPY --from=builder /src/package.json ./package.json

ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/app/data/site.db \
    UPLOADS_DIR=/app/data/uploads

EXPOSE 3001
VOLUME ["/app/data"]

# Health check matches the route we expose in server.ts. The 5s start period
# gives migrations a beat to apply on a cold container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/healthz || exit 1

CMD ["bun", "run", "server.ts"]
