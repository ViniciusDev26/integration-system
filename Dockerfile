# Production image for the API (apps/api) in the npm-workspaces monorepo.
# Multi-stage: build with full deps, ship only the compiled output + prod deps.
# See docs/adrs (monorepo/turborepo) and apps/api ADRs 0023/0005/0001/0006.
#
# A separate `dev` stage powers the Docker Compose dev environment (ADR 0029).
# The production `runner` stage is kept LAST so `docker build .` (no --target)
# still produces the production image. Build context is the repo ROOT so the
# workspace manifests + lockfile are available to `npm ci`.

# --- Dev stage: hot-reload for `docker compose up` (ADR 0029) ---
FROM node:24.18.0-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
# Workspace manifests + lockfile drive a deterministic install; source is
# bind-mounted at runtime by Compose (node_modules kept in named volumes).
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/biome-config/package.json ./packages/biome-config/package.json
RUN npm ci
USER node
EXPOSE 3000
CMD ["npm", "run", "dev", "-w", "@integration-system/api"]

# --- Stage 1: build (tsc -> apps/api/dist) ---
FROM node:24.18.0-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/biome-config/package.json ./packages/biome-config/package.json
RUN npm ci
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src ./apps/api/src
RUN npm run build -w @integration-system/api

# --- Stage 2: production dependencies only ---
FROM node:24.18.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/biome-config/package.json ./packages/biome-config/package.json
RUN npm ci --omit=dev

# --- Stage 3: runtime ---
FROM node:24.18.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
