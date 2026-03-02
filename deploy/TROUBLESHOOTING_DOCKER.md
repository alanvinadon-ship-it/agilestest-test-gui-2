# AgilesTest Docker Troubleshooting Guide

Solutions to common issues when deploying AgilesTest with Docker Compose.

## Error: "lstat /home/deploy: no such file or directory"

**Cause**: Absolute path `/home/deploy` is hardcoded in configuration files.

**Solution**: Use relative paths in `docker-compose.prod.yml`:

```yaml
# ❌ WRONG
volumes:
  - /home/deploy/data/postgres:/var/lib/postgresql/data

# ✅ CORRECT
volumes:
  - ./data/postgres:/var/lib/postgresql/data
```

All paths should be relative to the `deploy/` directory:
- `./data/postgres` → PostgreSQL data
- `./data/minio` → MinIO storage
- `./nginx/conf.d` → Nginx configuration
- `./scripts` → Operational scripts
- `./certs` → SSL certificates

## Error: "Cannot connect to Docker daemon"

**Cause**: Docker daemon is not running or user lacks permissions.

**Solution**:

```bash
# Start Docker daemon
sudo systemctl start docker

# Add user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker is working
docker ps
```

## Error: "Port 80 already in use"

**Cause**: Another service is using port 80 (web server, proxy, etc.).

**Solution**:

```bash
# Find process using port 80
sudo lsof -i :80
# or
sudo netstat -tlnp | grep :80

# Kill the process
sudo kill -9 <PID>

# Or change port in .env
NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443

# Update docker-compose.prod.yml
ports:
  - "${NGINX_HTTP_PORT:-80}:80"
  - "${NGINX_HTTPS_PORT:-443}:443"
```

## Error: "Database connection refused"

**Cause**: PostgreSQL container not running or not ready.

**Solution**:

```bash
# Check PostgreSQL status
docker compose ps postgres

# View PostgreSQL logs
./scripts/logs.sh postgres --tail 100

# Restart PostgreSQL
docker compose restart postgres

# Wait for health check
sleep 10
docker compose ps postgres

# Test connection
docker compose exec postgres psql -U agilestest -d agilestest_prod -c "SELECT 1"
```

## Error: "JWT token invalid or expired"

**Cause**: JWT_SECRET mismatch or token expired.

**Solution**:

```bash
# Generate new JWT_SECRET
openssl rand -base64 32

# Update .env
JWT_SECRET=<new-secret>

# Restart all services
./scripts/down.sh
./scripts/up.sh --build

# Login again to get new token
```

## Error: "MinIO bucket not found"

**Cause**: Bucket not created or MinIO not initialized.

**Solution**:

```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# Access MinIO console
# http://localhost:9001
# Username: minioadmin
# Password: From MINIO_ROOT_PASSWORD in .env

# Create bucket via CLI
docker compose exec minio mc mb minio/agilestest-artifacts

# Or via Docker
docker compose exec minio /minio/mc mb minio/agilestest-artifacts
```

## Error: "Nginx upstream timed out"

**Cause**: Backend service not responding or too slow.

**Solution**:

```bash
# Check service health
docker compose ps

# View service logs
./scripts/logs.sh admin-api --tail 200

# Increase timeout in nginx/conf.d/agilestest.conf
proxy_connect_timeout 120s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;

# Restart Nginx
docker compose restart nginx
```

## Error: "Out of disk space"

**Cause**: Docker images, containers, or volumes consuming too much space.

**Solution**:

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Clean up unused images
docker image prune -a

# Clean up unused volumes
docker volume prune

# Clean up unused containers
docker container prune

# Remove all AgilesTest data (WARNING: destructive)
./scripts/down.sh --remove-volumes
```

## Error: "Service keeps restarting"

**Cause**: Service crashes due to configuration or dependency issue.

**Solution**:

```bash
# View service logs
./scripts/logs.sh <service_name> --tail 500

# Check service dependencies
docker compose config | grep -A 5 "depends_on:"

# Restart service with verbose logging
docker compose restart <service_name>
docker compose logs -f <service_name>

# Common causes:
# - Database not ready (wait for health check)
# - Missing environment variables
# - Port already in use
# - Insufficient memory
```

## Error: "Smoke test fails at login"

**Cause**: Admin API not responding or credentials wrong.

**Solution**:

```bash
# Check Admin API status
docker compose ps admin-api

# Test login manually
curl -X POST http://localhost/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@agilestest.io","password":"admin123"}'

# Check database has seed data
docker compose exec postgres psql -U agilestest -d agilestest_prod \
  -c "SELECT email, role FROM users;"

# If no users, re-initialize database
docker compose exec postgres psql -U agilestest -d agilestest_prod \
  -f /docker-entrypoint-initdb.d/01-init.sql
```

## Error: "Frontend not loading"

**Cause**: Frontend service not running or Nginx routing incorrect.

**Solution**:

```bash
# Check frontend status
docker compose ps frontend

# Test frontend directly
curl http://localhost:3000/

# Check Nginx routing
docker compose exec nginx curl http://frontend:3000/

# View Nginx configuration
docker compose exec nginx cat /etc/nginx/conf.d/agilestest.conf

# Restart frontend and Nginx
docker compose restart frontend nginx
```

## Error: "File permissions denied"

**Cause**: Docker volumes have incorrect permissions.

**Solution**:

```bash
# Fix PostgreSQL data directory permissions
sudo chown -R 999:999 ./data/postgres

# Fix MinIO data directory permissions
sudo chown -R 1000:1000 ./data/minio

# Or run as root (not recommended)
docker compose down
sudo docker compose up -d
```

## Error: "Memory limit exceeded"

**Cause**: Services consuming more memory than available.

**Solution**:

```bash
# Check memory usage
docker stats

# Reduce service memory limits in docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 256M

# Or add swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Error: "SSL certificate validation failed"

**Cause**: Self-signed certificate or certificate path incorrect.

**Solution**:

```bash
# Generate new self-signed certificate
cd deploy/certs
openssl req -x509 -newkey rsa:4096 \
  -keyout agilestest.key \
  -out agilestest.crt \
  -days 365 -nodes

# Update nginx/conf.d/agilestest.conf with correct paths
ssl_certificate /etc/nginx/certs/agilestest.crt;
ssl_certificate_key /etc/nginx/certs/agilestest.key;

# Restart Nginx
docker compose restart nginx
```

## Error: "Backup fails"

**Cause**: PostgreSQL not accessible or insufficient disk space.

**Solution**:

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Test backup manually
docker compose exec -T postgres pg_dump -U agilestest agilestest_prod | gzip > test_backup.sql.gz

# Check disk space
df -h ./backups

# Verify backup file
gunzip -t test_backup.sql.gz
```

## Error: "Logs show 'health check failed'"

**Cause**: Service not responding to health check endpoint.

**Solution**:

```bash
# Test health endpoint manually
curl http://localhost/api/admin/health

# Increase health check timeout in docker-compose.prod.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s

# Restart services
docker compose down
docker compose up -d --build
```

## Performance Issues

### Slow API responses

```bash
# Check service CPU/memory
docker stats admin-api

# View slow queries
docker compose exec postgres psql -U agilestest -d agilestest_prod \
  -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Increase worker processes in nginx.conf
worker_processes auto;
```

### High disk usage

```bash
# Check largest tables
docker compose exec postgres psql -U agilestest -d agilestest_prod \
  -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Archive old artifacts
# (Implement retention policy in your application)
```

## Getting Help

1. **Check logs first**:
   ```bash
   docker compose logs -f
   ./scripts/logs.sh <service_name> --tail 500
   ```

2. **Run smoke tests**:
   ```bash
   ./scripts/smoke-test.sh --verbose
   ```

3. **Verify configuration**:
   ```bash
   cat .env | grep -v "^#"
   docker compose config
   ```

4. **Report issues** with:
   - Full error message
   - Output of `docker compose ps`
   - Output of `docker compose logs`
   - Your `.env` file (without secrets)
