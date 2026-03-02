#!/usr/bin/env bash
# ─── AgilesTest — Smoke Test ────────────────────────────────────────────
# Vérifie que tous les services sont opérationnels après installation.
# Usage : ./scripts/smoke_test.sh [base_url]
# Exit code : 0 = OK, 1 = FAIL
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:-http://localhost:${PROXY_HTTP_PORT:-80}}"
PASS=0
FAIL=0
TOTAL=0

# ── Couleurs ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
    local NAME="$1"
    local CMD="$2"
    TOTAL=$((TOTAL + 1))
    echo -n "  [${TOTAL}] ${NAME}... "
    if eval "${CMD}" >/dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          AgilesTest — Smoke Test                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Base URL : ${BASE_URL}"
echo "  Date     : $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── 1. Infrastructure ───────────────────────────────────────────────────
echo "─── Infrastructure ──────────────────────────────────────────────"

check "Reverse proxy health" \
    "curl -sf '${BASE_URL}/health'"

check "Frontend accessible" \
    "curl -sf '${BASE_URL}/' | grep -q 'AgilesTest'"

check "Frontend retourne HTML" \
    "curl -sf -o /dev/null -w '%{http_code}' '${BASE_URL}/' | grep -q '200'"

check "API orchestration health" \
    "curl -sf '${BASE_URL}/api/health' || curl -sf -o /dev/null -w '%{http_code}' '${BASE_URL}/api/health' | grep -qE '200|404'"

# ── 2. MinIO ────────────────────────────────────────────────────────────
echo ""
echo "─── MinIO ───────────────────────────────────────────────────────"

check "MinIO conteneur healthy" \
    "docker exec agilestest-minio mc ready local 2>/dev/null"

check "Bucket agilestest-artifacts existe" \
    "docker exec agilestest-minio mc ls local/${MINIO_BUCKET:-agilestest-artifacts} 2>/dev/null"

check "MinIO upload test" \
    "echo 'smoke-test' | docker exec -i agilestest-minio sh -c 'cat > /tmp/smoke-test.txt && mc cp /tmp/smoke-test.txt local/${MINIO_BUCKET:-agilestest-artifacts}/smoke-test.txt 2>/dev/null && mc rm local/${MINIO_BUCKET:-agilestest-artifacts}/smoke-test.txt 2>/dev/null && rm /tmp/smoke-test.txt'"

# ── 3. Services Docker ──────────────────────────────────────────────────
echo ""
echo "─── Services Docker ─────────────────────────────────────────────"

check "Conteneur proxy running" \
    "docker ps --filter name=agilestest-proxy --format '{{.Status}}' | grep -q 'Up'"

check "Conteneur frontend running" \
    "docker ps --filter name=agilestest-frontend --format '{{.Status}}' | grep -q 'Up'"

check "Conteneur orchestration running" \
    "docker ps --filter name=agilestest-orchestration --format '{{.Status}}' | grep -q 'Up'"

check "Conteneur runner running" \
    "docker ps --filter name=agilestest-runner --format '{{.Status}}' | grep -q 'Up'"

check "Conteneur minio running" \
    "docker ps --filter name=agilestest-minio --format '{{.Status}}' | grep -q 'Up'"

# ── 4. Sécurité ─────────────────────────────────────────────────────────
echo ""
echo "─── Sécurité ────────────────────────────────────────────────────"

check "Header X-Frame-Options présent" \
    "curl -sI '${BASE_URL}/' | grep -qi 'X-Frame-Options'"

check "Header X-Content-Type-Options présent" \
    "curl -sI '${BASE_URL}/' | grep -qi 'X-Content-Type-Options'"

# ── 5. Fonctionnel ──────────────────────────────────────────────────────
echo ""
echo "─── Fonctionnel ─────────────────────────────────────────────────"

check "Page de login accessible" \
    "curl -sf '${BASE_URL}/' | grep -qi 'connexion\|login\|AgilesTest'"

check "Assets CSS/JS chargés" \
    "curl -sf '${BASE_URL}/' | grep -qE '\.js|\.css'"

check "Pas d'erreur 500 sur /" \
    "HTTP_CODE=\$(curl -sf -o /dev/null -w '%{http_code}' '${BASE_URL}/'); [ \"\${HTTP_CODE}\" != '500' ]"

# ── Résumé ───────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ ${FAIL} -eq 0 ]; then
    echo -e "  Résultat : ${GREEN}${PASS}/${TOTAL} PASS${NC} — Tous les tests réussis ✓"
    echo ""
    exit 0
else
    echo -e "  Résultat : ${GREEN}${PASS} PASS${NC} / ${RED}${FAIL} FAIL${NC} / ${TOTAL} total"
    echo ""
    echo "  ⚠️  ${FAIL} test(s) échoué(s). Vérifier les logs :"
    echo "     docker compose -f docker-compose.prod.yml logs"
    echo ""
    exit 1
fi
