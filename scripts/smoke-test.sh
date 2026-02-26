#!/usr/bin/env bash
# ============================================================================
# AgilesTest — Post-deployment smoke test
# Usage: ./scripts/smoke-test.sh [base_url]
# Default base_url: http://localhost
# ============================================================================
set -euo pipefail

BASE_URL="${1:-http://localhost}"
PASS=0
FAIL=0
TOTAL=0

check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  TOTAL=$((TOTAL + 1))

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    echo "  ✓ $name (HTTP $status)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — expected $expected_status, got $status"
    FAIL=$((FAIL + 1))
  fi
}

check_json() {
  local name="$1"
  local url="$2"
  local jq_filter="$3"
  local expected="$4"
  TOTAL=$((TOTAL + 1))

  local result
  result=$(curl -s --max-time 10 "$url" 2>/dev/null | jq -r "$jq_filter" 2>/dev/null || echo "ERROR")

  if [ "$result" = "$expected" ]; then
    echo "  ✓ $name ($jq_filter = $expected)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — expected $jq_filter=$expected, got $result"
    FAIL=$((FAIL + 1))
  fi
}

check_header() {
  local name="$1"
  local url="$2"
  local header="$3"
  TOTAL=$((TOTAL + 1))

  local value
  value=$(curl -s -I --max-time 10 "$url" 2>/dev/null | grep -i "^$header:" || echo "")

  if [ -n "$value" ]; then
    echo "  ✓ $name (header $header present)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — header $header missing"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================"
echo " AgilesTest Smoke Test"
echo " Target: $BASE_URL"
echo " Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================"
echo ""

echo "── Health Endpoints ──"
check "Healthz" "$BASE_URL/healthz"
check_json "Healthz status" "$BASE_URL/healthz" ".status" "ok"
check "Readyz" "$BASE_URL/readyz"
check_json "Readyz status" "$BASE_URL/readyz" ".status" "ready"

echo ""
echo "── Frontend ──"
check "Homepage loads" "$BASE_URL/"
check "Static assets" "$BASE_URL/favicon.ico" "200"

echo ""
echo "── API ──"
check "tRPC auth.me (unauthenticated)" "$BASE_URL/api/trpc/auth.me" "200"

echo ""
echo "── Security Headers ──"
check_header "X-Content-Type-Options" "$BASE_URL/healthz" "x-content-type-options"
check_header "X-Frame-Options" "$BASE_URL/healthz" "x-frame-options"
check_header "X-Request-Id" "$BASE_URL/healthz" "x-request-id"

echo ""
echo "── Metrics ──"
check "Metrics (no auth)" "$BASE_URL/metrics" "200"

echo ""
echo "============================================"
echo " Results: $PASS/$TOTAL passed, $FAIL failed"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "⚠ Some checks failed. Review the output above."
  exit 1
else
  echo ""
  echo "✓ All smoke tests passed."
  exit 0
fi
