#!/bin/bash
# ─── AgilesTest Smoke Test Script ──────────────────────────────────────────────
# Validates the Happy Path: login → CRUD project → execution → artifact → report
# Usage: ./deploy/scripts/smoke-test.sh [--verbose]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost}"
VERBOSE="${1:-}"
ADMIN_EMAIL="admin@agilestest.io"
ADMIN_PASSWORD="admin123"

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# ─── Helper Functions ──────────────────────────────────────────────────────────

log_test() {
  echo -e "${BLUE}[TEST]${NC} $1"
}

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((TESTS_PASSED++))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((TESTS_FAILED++))
}

log_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

http_get() {
  local url="$1"
  local token="$2"
  
  if [ -n "$token" ]; then
    curl -s -X GET "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json"
  else
    curl -s -X GET "$url" \
      -H "Content-Type: application/json"
  fi
}

http_post() {
  local url="$1"
  local data="$2"
  local token="$3"
  
  if [ -n "$token" ]; then
    curl -s -X POST "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X POST "$url" \
      -H "Content-Type: application/json" \
      -d "$data"
  fi
}

http_status() {
  local url="$1"
  local token="$2"
  
  if [ -n "$token" ]; then
    curl -s -o /dev/null -w "%{http_code}" -X GET "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json"
  else
    curl -s -o /dev/null -w "%{http_code}" -X GET "$url" \
      -H "Content-Type: application/json"
  fi
}

# ─── Test Suite ───────────────────────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        AgilesTest Smoke Test - Happy Path Validation           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Base URL: $BASE_URL"
echo ""

# Test 1: Nginx Health Check
log_test "Nginx health check"
STATUS=$(http_status "$BASE_URL/health")
if [ "$STATUS" = "200" ]; then
  log_pass "Nginx is responding (HTTP $STATUS)"
else
  log_fail "Nginx health check failed (HTTP $STATUS)"
  exit 1
fi

# Test 2: Admin API Health
log_test "Admin API health check"
STATUS=$(http_status "$BASE_URL/api/admin/health")
if [ "$STATUS" = "200" ]; then
  log_pass "Admin API is healthy (HTTP $STATUS)"
else
  log_fail "Admin API health check failed (HTTP $STATUS)"
fi

# Test 3: Repository API Health
log_test "Repository API health check"
STATUS=$(http_status "$BASE_URL/api/repository/health")
if [ "$STATUS" = "200" ]; then
  log_pass "Repository API is healthy (HTTP $STATUS)"
else
  log_fail "Repository API health check failed (HTTP $STATUS)"
fi

# Test 4: Orchestration API Health
log_test "Orchestration API health check"
STATUS=$(http_status "$BASE_URL/api/orchestration/health")
if [ "$STATUS" = "200" ]; then
  log_pass "Orchestration API is healthy (HTTP $STATUS)"
else
  log_fail "Orchestration API health check failed (HTTP $STATUS)"
fi

# Test 5: Collector API Health
log_test "Collector API health check"
STATUS=$(http_status "$BASE_URL/api/collector/health")
if [ "$STATUS" = "200" ]; then
  log_pass "Collector API is healthy (HTTP $STATUS)"
else
  log_fail "Collector API health check failed (HTTP $STATUS)"
fi

# Test 6: Analysis API Health
log_test "Analysis API health check"
STATUS=$(http_status "$BASE_URL/api/analysis/health")
if [ "$STATUS" = "200" ]; then
  log_pass "Analysis API is healthy (HTTP $STATUS)"
else
  log_fail "Analysis API health check failed (HTTP $STATUS)"
fi

# Test 7: Reporting API Health
log_test "Reporting API health check"
STATUS=$(http_status "$BASE_URL/api/reporting/health")
if [ "$STATUS" = "200" ]; then
  log_pass "Reporting API is healthy (HTTP $STATUS)"
else
  log_fail "Reporting API health check failed (HTTP $STATUS)"
fi

# Test 8: Admin Login
log_test "Admin login"
LOGIN_RESPONSE=$(http_post "$BASE_URL/api/admin/auth/login" \
  "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -n "$JWT_TOKEN" ] && [ ${#JWT_TOKEN} -gt 10 ]; then
  log_pass "Admin login successful, JWT token obtained"
  if [ "$VERBOSE" = "--verbose" ]; then
    log_info "Token: ${JWT_TOKEN:0:20}..."
  fi
else
  log_fail "Admin login failed or invalid token"
  if [ "$VERBOSE" = "--verbose" ]; then
    log_info "Response: $LOGIN_RESPONSE"
  fi
  exit 1
fi

# Test 9: Create Project (Repository API)
log_test "Create project (CRUD)"
PROJECT_DATA="{\"name\":\"Smoke Test Project\",\"description\":\"Auto-generated test project\",\"domain\":\"WEB\"}"
PROJECT_RESPONSE=$(http_post "$BASE_URL/api/repository/projects" "$PROJECT_DATA" "$JWT_TOKEN")

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$PROJECT_ID" ] && [ ${#PROJECT_ID} -gt 5 ]; then
  log_pass "Project created successfully (ID: ${PROJECT_ID:0:8}...)"
else
  log_fail "Project creation failed"
  if [ "$VERBOSE" = "--verbose" ]; then
    log_info "Response: $PROJECT_RESPONSE"
  fi
fi

# Test 10: Get Project (Repository API)
if [ -n "$PROJECT_ID" ]; then
  log_test "Get project details"
  GET_PROJECT=$(http_get "$BASE_URL/api/repository/projects/$PROJECT_ID" "$JWT_TOKEN")
  
  if echo "$GET_PROJECT" | grep -q "$PROJECT_ID"; then
    log_pass "Project retrieved successfully"
  else
    log_fail "Failed to retrieve project"
  fi
fi

# Test 11: Create Execution (Orchestration API)
if [ -n "$PROJECT_ID" ]; then
  log_test "Create execution"
  EXEC_DATA="{\"project_id\":\"$PROJECT_ID\",\"profile_id\":\"test-profile\",\"scenario_id\":\"test-scenario\",\"runner_type\":\"docker\"}"
  EXEC_RESPONSE=$(http_post "$BASE_URL/api/orchestration/executions" "$EXEC_DATA" "$JWT_TOKEN")
  
  EXEC_ID=$(echo "$EXEC_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  
  if [ -n "$EXEC_ID" ] && [ ${#EXEC_ID} -gt 5 ]; then
    log_pass "Execution created successfully (ID: ${EXEC_ID:0:8}...)"
  else
    log_fail "Execution creation failed"
    if [ "$VERBOSE" = "--verbose" ]; then
      log_info "Response: $EXEC_RESPONSE"
    fi
  fi
fi

# Test 12: Upload Artifact (Collector API)
if [ -n "$EXEC_ID" ]; then
  log_test "Upload artifact"
  
  # Create a temporary test file
  TEST_ARTIFACT="/tmp/test_artifact_$$.log"
  echo "Test artifact content - $(date)" > "$TEST_ARTIFACT"
  
  # Upload artifact
  UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/collector/artifacts" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -F "execution_id=$EXEC_ID" \
    -F "type=LOG" \
    -F "file=@$TEST_ARTIFACT")
  
  if echo "$UPLOAD_RESPONSE" | grep -q "success\|artifact"; then
    log_pass "Artifact uploaded successfully"
  else
    log_fail "Artifact upload failed"
    if [ "$VERBOSE" = "--verbose" ]; then
      log_info "Response: $UPLOAD_RESPONSE"
    fi
  fi
  
  rm -f "$TEST_ARTIFACT"
fi

# Test 13: Trigger Analysis
if [ -n "$EXEC_ID" ]; then
  log_test "Trigger analysis"
  ANALYSIS_DATA="{\"execution_id\":\"$EXEC_ID\"}"
  ANALYSIS_RESPONSE=$(http_post "$BASE_URL/api/analysis/analyze" "$ANALYSIS_DATA" "$JWT_TOKEN")
  
  if echo "$ANALYSIS_RESPONSE" | grep -q "success\|analysis"; then
    log_pass "Analysis triggered successfully"
  else
    log_fail "Analysis trigger failed (may be expected if not implemented)"
  fi
fi

# Test 14: Get Report (Reporting API)
if [ -n "$EXEC_ID" ]; then
  log_test "Get execution report"
  REPORT_RESPONSE=$(http_get "$BASE_URL/api/reporting/executions/$EXEC_ID/report" "$JWT_TOKEN")
  
  if echo "$REPORT_RESPONSE" | grep -q "success\|report\|execution"; then
    log_pass "Report retrieved successfully"
  else
    log_fail "Report retrieval failed (may be expected if not implemented)"
  fi
fi

# ─── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Test Summary                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "✅ Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "❌ Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed! AgilesTest is ready for production.${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some tests failed. Please review the output above.${NC}"
  exit 1
fi
