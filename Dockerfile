# ============================================================================
# AgilesTest — Multi-stage Dockerfile
# Stage 1: Install dependencies + build frontend (Vite) + bundle backend (esbuild)
# Stage 2: Production runtime (Node.js slim)
# ============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build frontend (Vite → dist/client) + backend (esbuild → dist/index.js)
RUN pnpm build

# ── Stage 2: Production runtime ────────────────────────────────────────────
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copy dependency manifests and install production-only deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy drizzle schema + migrations for db:push at runtime
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy shared constants
COPY --from=builder /app/shared ./shared

# Non-root user
RUN addgroup --system --gid 1001 agilestest && \
    adduser --system --uid 1001 --ingroup agilestest agilestest
USER agilestest

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/healthz || exit 1

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]
