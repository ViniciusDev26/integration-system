# Production image for the API. Multi-stage: build with full deps, ship only
# the compiled output + production deps. See ADR 0023 and ADR 0005 (tsc ->
# node dist/server.js), ADR 0001 (Node 24), ADR 0006 (npm).

# --- Stage 1: build (tsc -> dist) ---
FROM node:24.18.0-alpine AS builder
WORKDIR /app
# Install all deps (incl. dev) for the TypeScript build. .npmrc keeps installs
# deterministic (save-exact) and engine-strict (ADR 0006).
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY tsconfig.json ./
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
