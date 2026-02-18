# ─── AgilesTest Runner Agent ─────────────────────────────────────────────
# Image Node.js + Playwright browsers pour l'exécution réelle de scripts.
# Usage : docker build -t agilestest-runner-agent .
# ─────────────────────────────────────────────────────────────────────────

FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /app

# Dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    tcpdump \
    && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de configuration
COPY package.json tsconfig.json ./
RUN npm install --production=false

# Copier le code source
COPY src/ ./src/

# Compiler TypeScript
RUN npx tsc

# Répertoire de travail pour les scripts téléchargés
RUN mkdir -p /workspace /artifacts

ENV NODE_ENV=production
ENV RUNNER_ID=runner-docker-01
ENV ORCHESTRATION_URL=http://orchestration:4000
ENV MINIO_ENDPOINT=minio
ENV MINIO_PORT=9000
ENV MINIO_ACCESS_KEY=minioadmin
ENV MINIO_SECRET_KEY=minioadmin
ENV MINIO_BUCKET=agilestest-artifacts
ENV MINIO_USE_SSL=false
ENV POLL_INTERVAL_MS=5000

CMD ["node", "dist/agent.js"]
