# ============================================================================
# AgilesTest — Multi-stage Dockerfile
# Stage 1: Install dependencies + build frontend (Vite) + bundle backend (esbuild)
# Stage 2: Production runtime (Node.js slim + Playwright Chromium)
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

# ── 2a. System dependencies for Chromium ───────────────────────────────────
# These are the minimal libraries required by Playwright Chromium on Debian/Ubuntu.
# Ref: https://playwright.dev/docs/browsers#linux-dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    # Chromium runtime dependencies
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libwayland-client0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    # Fonts for proper text rendering
    fonts-liberation \
    fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app

# Copy dependency manifests and install production-only deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

# ── 2b. Install Playwright Chromium browser ────────────────────────────────
# Download Chromium into the Playwright cache so it's available at runtime.
# This avoids downloading at first execution (saves ~1-2 min on first run).
RUN npx playwright install chromium

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy drizzle schema + migrations for db:push at runtime
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy shared constants
COPY --from=builder /app/shared ./shared

# Non-root user
# Note: Playwright cache is at /root/.cache/ms-playwright/ — we move it to
# the app user's home so it's accessible after switching to non-root.
RUN addgroup --system --gid 1001 agilestest && \
    adduser --system --uid 1001 --ingroup agilestest agilestest && \
    mkdir -p /home/agilestest/.cache && \
    cp -r /root/.cache/ms-playwright /home/agilestest/.cache/ms-playwright && \
    chown -R agilestest:agilestest /home/agilestest/.cache

USER agilestest

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/healthz || exit 1

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]
