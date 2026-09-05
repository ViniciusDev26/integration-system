# Production image for the API. Multi-stage: build with full deps, ship only
# the compiled output + production deps. See ADR 0023 and ADR 0005 (tsc ->
# node dist/server.js), ADR 0001 (Node 24), ADR 0006 (npm).
#
# A separate `dev` stage powers the Docker Compose dev environment (ADR 0029).
# The production `runner` stage is kept LAST so `docker build .` (no --target)
# still produces the production image.

# --- Dev stage: hot-reload for `docker compose up` (ADR 0029) ---
# Not shipped to production. Full deps (incl. tsc-watch). Compose bind-mounts the
# source at runtime, so no `src` is copied here; node_modules stays in the image
# (Compose keeps them in a named volume). Runs as the unprivileged `node` user
# (uid 1000) so files written to the bind mount stay owned by the host developer.
FROM node:24.18.0-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json .npmrc ./
RUN npm ci
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- Stage 1: build (tsc -> dist) ---
FROM node:24.18.0-alpine AS builder
WORKDIR /app
# Install all deps (incl. dev) for the TypeScript build. .npmrc keeps installs
# deterministic (save-exact) and engine-strict (ADR 0006).
COPY package.json package-lock.json .npmrc ./
RUN npm ci
# tsconfig.build.json (used by `npm run build`) extends tsconfig.json — both are
# needed. The build also copies src/views into dist (ADR 0030), so they ship.
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Stage 2: production dependencies only ---
FROM node:24.18.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

# --- Stage 3: runtime ---
FROM node:24.18.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Non-root: the base image ships an unprivileged `node` user.
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
