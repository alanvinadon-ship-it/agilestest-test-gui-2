# AgilesTest Production Deployment

Complete Docker Compose setup for deploying AgilesTest in production with 6 microservices, PostgreSQL, MinIO, and Nginx.

## 📋 Quick Links

- **[DEPLOY_DOCKER_PROD.md](./DEPLOY_DOCKER_PROD.md)** - Step-by-step deployment guide
- **[TROUBLESHOOTING_DOCKER.md](./TROUBLESHOOTING_DOCKER.md)** - Common issues and solutions
- **[.env.example](./.env.example)** - Environment variables template

## 🚀 Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit configuration
nano .env

# 3. Start services
./scripts/up.sh --build

# 4. Run smoke tests
./scripts/smoke-test.sh
```

## 📁 Directory Structure

```
deploy/
├── docker-compose.prod.yml      # Main Docker Compose configuration
├── .env.example                 # Environment variables template
├── .env                         # Production environment (DO NOT COMMIT)
├── nginx/
│   ├── nginx.conf              # Nginx main configuration
│   └── conf.d/
│       └── agilestest.conf     # AgilesTest routing rules
├── scripts/
│   ├── up.sh                   # Start services
│   ├── down.sh                 # Stop services
│   ├── logs.sh                 # View service logs
│   ├── backup-postgres.sh      # Backup database
│   ├── smoke-test.sh           # Validate deployment
│   └── init-db.sql             # Database initialization
├── data/                       # Persistent volumes (auto-created)
│   ├── postgres/               # PostgreSQL data
│   └── minio/                  # MinIO storage
├── certs/                      # SSL certificates
├── backups/                    # Database backups
├── DEPLOY_DOCKER_PROD.md       # Deployment guide
├── TROUBLESHOOTING_DOCKER.md   # Troubleshooting guide
└── README.md                   # This file
```

## 🐳 Services

| Service | Port | Purpose |
|---------|------|---------|
| **Nginx** | 80, 443 | Reverse proxy & load balancer |
| **Frontend** | 3000 | React web application |
| **Admin API** | 3001 | User & project management |
| **Repository API** | 3002 | Test artifacts & scenarios |
| **Orchestration API** | 3003 | Test execution engine |
| **Collector API** | 3004 | Artifact collection & storage |
| **Analysis API** | 3005 | Incident detection & analysis |
| **Reporting API** | 3006 | Report generation |
| **PostgreSQL** | 5432 | Primary database |
| **MinIO** | 9000, 9001 | S3-compatible storage |

## 🔧 Operational Scripts

### Start Services
```bash
./scripts/up.sh [--build] [--no-logs]
```
- `--build`: Rebuild Docker images
- `--no-logs`: Start in background

### Stop Services
```bash
./scripts/down.sh [--remove-volumes]
```
- `--remove-volumes`: Delete all data (⚠️ destructive)

### View Logs
```bash
./scripts/logs.sh [service_name] [--tail 100]
```
Examples:
```bash
./scripts/logs.sh admin-api --tail 100
./scripts/logs.sh                      # List available services
```

### Backup Database
```bash
./scripts/backup-postgres.sh
```
Creates compressed backup in `backups/` directory.

### Validate Deployment
```bash
./scripts/smoke-test.sh [--verbose]
```
Tests all 6 APIs, login, CRUD operations, and report generation.

## 🔐 Security

### Default Credentials (CHANGE IN PRODUCTION)

| Email | Password | Role |
|-------|----------|------|
| `admin@agilestest.io` | `admin123` | Admin |
| `manager@agilestest.io` | `manager123` | Manager |
| `viewer@agilestest.io` | `viewer123` | Viewer |

### Required Changes

1. **Generate strong secrets**:
   ```bash
   openssl rand -base64 32  # JWT_SECRET
   openssl rand -base64 32  # MINIO_ROOT_PASSWORD
   ```

2. **Update `.env`**:
   ```bash
   DB_PASSWORD=<strong-password>
   JWT_SECRET=<random-secret>
   MINIO_ROOT_PASSWORD=<strong-password>
   ```

3. **Configure SSL/TLS**:
   ```bash
   cd certs
   openssl req -x509 -newkey rsa:4096 -keyout agilestest.key -out agilestest.crt -days 365 -nodes
   ```

4. **Enable HTTPS** in `nginx/conf.d/agilestest.conf` (uncomment HTTPS block)

## 📊 Monitoring

### Check Service Status
```bash
docker compose ps
```

### View System Resources
```bash
docker stats
```

### Database Health
```bash
docker compose exec postgres psql -U agilestest -d agilestest_prod -c "SELECT 1"
```

### MinIO Health
```bash
curl http://localhost:9000/minio/health/live
```

## 🔄 Scaling

Run multiple instances of a service:
```bash
docker compose up -d --scale admin-api=3
```

## 📈 Performance Tuning

1. **PostgreSQL**: Adjust `shared_buffers` in `init-db.sql`
2. **Nginx**: Tune `worker_connections` in `nginx/nginx.conf`
3. **MinIO**: Configure erasure coding for distributed setup
4. **Services**: Set resource limits in `docker-compose.prod.yml`

## 🆘 Troubleshooting

For common issues and solutions, see **[TROUBLESHOOTING_DOCKER.md](./TROUBLESHOOTING_DOCKER.md)**

Quick diagnosis:
```bash
# Check all services
docker compose ps

# View recent errors
docker compose logs --tail 100

# Run smoke tests
./scripts/smoke-test.sh --verbose

# Check specific service
./scripts/logs.sh <service_name> --tail 500
```

## 📚 Documentation

- **[DEPLOY_DOCKER_PROD.md](./DEPLOY_DOCKER_PROD.md)** - Complete deployment guide
- **[TROUBLESHOOTING_DOCKER.md](./TROUBLESHOOTING_DOCKER.md)** - Error solutions
- **[.env.example](./.env.example)** - Configuration reference

## 🚨 Disaster Recovery

### Backup Database
```bash
./scripts/backup-postgres.sh
```

### Restore from Backup
```bash
docker compose exec -T postgres psql -U agilestest agilestest_prod < backups/agilestest_db_20240219_020000.sql
```

### Restore MinIO Buckets
```bash
./scripts/restore_minio.sh backups/minio_backup.tar.gz
```

## 📞 Support

- **Issues**: https://github.com/agileslab/agilestest/issues
- **Docs**: https://docs.agilestest.io
- **Community**: https://community.agilestest.io

## 📝 License

AgilesTest is licensed under the Apache License 2.0. See LICENSE file for details.

---

**Last Updated**: February 2024  
**Version**: 0.1.2
