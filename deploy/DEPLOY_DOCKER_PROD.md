# AgilesTest Production Docker Deployment Guide

Complete step-by-step guide to deploy AgilesTest on Docker Compose in production.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose 2.0+
- 8GB RAM minimum (16GB recommended)
- 50GB free disk space
- Linux/macOS (Windows with WSL2 supported)

## Quick Start (5 minutes)

```bash
# 1. Clone repository and navigate to deploy directory
cd deploy

# 2. Copy and configure environment
cp .env.example .env
nano .env  # Edit database password, JWT secret, etc.

# 3. Generate strong secrets (recommended)
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For MINIO_ROOT_PASSWORD

# 4. Start all services
./scripts/up.sh --build

# 5. Run smoke tests
./scripts/smoke-test.sh
```

## Detailed Setup

### Step 1: Prepare the Environment

```bash
# Create deploy directory structure (if not already present)
mkdir -p deploy/{data/{postgres,minio},nginx/conf.d,scripts,certs,backups}

# Navigate to deploy directory
cd deploy

# Copy environment template
cp .env.example .env
```

### Step 2: Configure Environment Variables

Edit `.env` with your production settings:

```bash
nano .env
```

**Critical variables to change:**

| Variable | Default | Action |
|----------|---------|--------|
| `DB_PASSWORD` | `agilestest_prod_secret_change_me` | **CHANGE** to strong password |
| `JWT_SECRET` | `your-super-secret-jwt-key...` | **CHANGE** to `openssl rand -base64 32` output |
| `MINIO_ROOT_PASSWORD` | `minioadmin_prod_secret_change_me` | **CHANGE** to strong password |
| `BASE_URL` | `http://localhost` | Update to your domain (e.g., `https://agilestest.example.com`) |

**Optional variables:**

- `LOG_LEVEL`: Set to `debug` for troubleshooting, `info` for production
- `SMTP_*`: Configure email notifications
- `K8S_*`: If using Kubernetes runners

### Step 3: Build and Start Services

```bash
# Build and start all services in background
./scripts/up.sh --build --no-logs

# Or start with logs visible (Ctrl+C to detach)
./scripts/up.sh --build
```

**What happens:**
1. Docker builds 6 microservices from Dockerfiles
2. PostgreSQL initializes with seed data (3 users)
3. MinIO creates artifact storage buckets
4. Nginx configures reverse proxy routing
5. All services perform health checks

### Step 4: Verify Deployment

```bash
# Check service status
docker compose ps

# Run comprehensive smoke tests
./scripts/smoke-test.sh

# View logs for specific service
./scripts/logs.sh admin-api --tail 100
```

### Step 5: Access AgilesTest

- **Frontend**: http://localhost (or your configured BASE_URL)
- **MinIO Console**: http://localhost:9001
  - Username: `minioadmin`
  - Password: From `MINIO_ROOT_PASSWORD` in `.env`

**Default Login Credentials:**

| Email | Password | Role |
|-------|----------|------|
| `admin@agilestest.io` | `admin123` | Admin |
| `manager@agilestest.io` | `manager123` | Manager |
| `viewer@agilestest.io` | `viewer123` | Viewer |

⚠️ **Change these passwords immediately in production!**

## Production Best Practices

### 1. SSL/TLS Configuration

Generate self-signed certificate for local testing:

```bash
cd deploy/certs
openssl req -x509 -newkey rsa:4096 -keyout agilestest.key -out agilestest.crt -days 365 -nodes
cd ..
```

Enable HTTPS in `nginx/conf.d/agilestest.conf` by uncommenting the HTTPS server block.

### 2. Database Backups

Automated daily backups at 2 AM:

```bash
# Manual backup
./scripts/backup-postgres.sh

# Restore from backup
docker compose exec -T postgres psql -U agilestest agilestest_prod < backups/agilestest_db_20240219_020000.sql
```

### 3. Monitoring & Logs

```bash
# View all logs
docker compose logs -f

# Follow specific service
./scripts/logs.sh orchestration-api -f

# Export logs to file
docker compose logs > logs/agilestest_$(date +%Y%m%d_%H%M%S).log
```

### 4. Resource Limits

Edit `docker-compose.prod.yml` to set resource limits:

```yaml
services:
  admin-api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 5. Scaling Services

To run multiple instances of a service:

```bash
docker compose up -d --scale admin-api=3
```

## Troubleshooting

### Services Not Starting

```bash
# Check Docker daemon
docker ps

# View service logs
./scripts/logs.sh <service_name> --tail 200

# Restart specific service
docker compose restart <service_name>
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
docker compose exec postgres psql -U agilestest -d agilestest_prod -c "SELECT 1"

# Check database size
docker compose exec postgres psql -U agilestest -d agilestest_prod -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database ORDER BY pg_database_size DESC;"
```

### MinIO Issues

```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# List buckets
docker compose exec minio mc ls minio/

# Create bucket
docker compose exec minio mc mb minio/agilestest-artifacts
```

### Port Already in Use

If ports 80, 443, 3000, 9000, or 5432 are already in use:

```bash
# Find process using port
lsof -i :80

# Change port in .env
# Then restart services
./scripts/down.sh
./scripts/up.sh --build
```

## Maintenance

### Update Services

```bash
# Pull latest code
git pull

# Rebuild and restart
./scripts/down.sh
./scripts/up.sh --build
```

### Clean Up

```bash
# Remove stopped containers
docker compose down

# Remove all data (WARNING: destructive)
./scripts/down.sh --remove-volumes

# Clean unused images
docker image prune -a
```

### Performance Tuning

1. **PostgreSQL**: Adjust `shared_buffers` and `work_mem` in `init-db.sql`
2. **MinIO**: Increase `MINIO_ERASURE_SET_DRIVE_COUNT` for distributed setup
3. **Nginx**: Tune `worker_connections` and `proxy_buffer_size` in `nginx.conf`

## Security Checklist

- [ ] Changed all default passwords in `.env`
- [ ] Generated strong JWT_SECRET with `openssl rand -base64 32`
- [ ] Configured SSL/TLS certificates
- [ ] Set `LOG_LEVEL=info` (not `debug`)
- [ ] Enabled firewall rules (only expose ports 80, 443)
- [ ] Configured database backups
- [ ] Set up monitoring and alerting
- [ ] Reviewed Nginx security headers
- [ ] Disabled MinIO console in production (if not needed)

## Support & Documentation

- **GitHub Issues**: https://github.com/agileslab/agilestest/issues
- **Documentation**: https://docs.agilestest.io
- **Community Forum**: https://community.agilestest.io

## Version Information

- **AgilesTest**: v0.1.2
- **Docker Compose**: 3.9
- **PostgreSQL**: 16-alpine
- **Nginx**: 1.25-alpine
- **MinIO**: RELEASE.2024-01-31
