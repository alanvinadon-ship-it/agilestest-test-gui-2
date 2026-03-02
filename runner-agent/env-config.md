# Runner Agent — Environment Configuration

Copy these variables into your `.env` file:

```bash
# ─── Runner Agent Configuration ──────────────────────────────────────────
RUNNER_ID=runner-docker-01
ORCHESTRATION_URL=http://orchestration:4000
POLL_INTERVAL_MS=5000

# ─── MinIO / S3 Configuration ───────────────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=agilestest-artifacts
MINIO_USE_SSL=false
MINIO_REGION=us-east-1

# ─── Playwright ──────────────────────────────────────────────────────────
WORKSPACE_DIR=/workspace
ARTIFACTS_DIR=/artifacts
BASE_URL=http://target-app:3000
```
