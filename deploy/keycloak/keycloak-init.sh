#!/bin/sh
# ============================================================================
# Keycloak Realm Initialization Script
# Creates realm, client, and optionally configures Google Identity Provider
# ============================================================================
set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Keycloak Realm Initialization                     ║"
echo "╚══════════════════════════════════════════════════════════╝"

KEYCLOAK_URL="${KEYCLOAK_URL:-http://127.0.0.1:8180}"
ADMIN="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM="${KEYCLOAK_REALM:-agilestest}"
CLIENT_ID="${KEYCLOAK_CLIENT_ID:-agilestest-app}"
CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-agilestest-secret}"
APP_URL="${APP_URL:-http://localhost:8080}"

echo "▶ Waiting for Keycloak to be ready..."
for i in $(seq 1 30); do
  if curl -sf "${KEYCLOAK_URL}/health/ready" > /dev/null 2>&1 || curl -sf "${KEYCLOAK_URL}/realms/master" > /dev/null 2>&1; then
    echo "  ✔ Keycloak is ready"
    break
  fi
  echo "  ⏳ Attempt $i/30..."
  sleep 5
done

# ── 1. Get admin token ─────────────────────────────────────────────────────
echo "▶ Obtaining admin token..."
TOKEN=$(curl -sf -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN}" \
  -d "password=${ADMIN_PASS}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | sed 's/.*"access_token":"\([^"]*\)".*/\1/')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "  ✘ Failed to obtain admin token"
  exit 1
fi
echo "  ✔ Admin token obtained"

# ── 2. Check if realm exists ───────────────────────────────────────────────
echo "▶ Checking realm '${REALM}'..."
REALM_EXISTS=$(curl -sf -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "${KEYCLOAK_URL}/admin/realms/${REALM}")

if [ "$REALM_EXISTS" = "200" ]; then
  echo "  ✔ Realm '${REALM}' already exists"
else
  echo "  ▶ Creating realm '${REALM}'..."
  curl -sf -X POST "${KEYCLOAK_URL}/admin/realms" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"realm\": \"${REALM}\",
      \"enabled\": true,
      \"displayName\": \"AgilesTest\",
      \"registrationAllowed\": false,
      \"loginWithEmailAllowed\": true,
      \"duplicateEmailsAllowed\": false,
      \"resetPasswordAllowed\": true,
      \"editUsernameAllowed\": false,
      \"bruteForceProtected\": true,
      \"sslRequired\": \"none\",
      \"accessTokenLifespan\": 3600,
      \"ssoSessionIdleTimeout\": 86400,
      \"ssoSessionMaxLifespan\": 604800
    }"
  echo "  ✔ Realm '${REALM}' created"
fi

# ── 3. Create or update client ─────────────────────────────────────────────
echo "▶ Configuring client '${CLIENT_ID}'..."

# Check if client exists
EXISTING_CLIENT=$(curl -sf \
  -H "Authorization: Bearer ${TOKEN}" \
  "${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}" | sed 's/\[//;s/\]//')

if [ -n "$EXISTING_CLIENT" ] && [ "$EXISTING_CLIENT" != "" ]; then
  echo "  ✔ Client '${CLIENT_ID}' already exists"
else
  curl -sf -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/clients" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"clientId\": \"${CLIENT_ID}\",
      \"name\": \"AgilesTest Application\",
      \"enabled\": true,
      \"protocol\": \"openid-connect\",
      \"publicClient\": false,
      \"secret\": \"${CLIENT_SECRET}\",
      \"standardFlowEnabled\": true,
      \"directAccessGrantsEnabled\": true,
      \"serviceAccountsEnabled\": false,
      \"redirectUris\": [
        \"${APP_URL}/*\",
        \"http://localhost:8080/*\",
        \"http://localhost:3000/*\"
      ],
      \"webOrigins\": [
        \"${APP_URL}\",
        \"http://localhost:8080\",
        \"http://localhost:3000\",
        \"+\"
      ],
      \"attributes\": {
        \"post.logout.redirect.uris\": \"${APP_URL}/*\"
      }
    }"
  echo "  ✔ Client '${CLIENT_ID}' created"
fi

# ── 4. Configure Google Identity Provider (if credentials provided) ────────
if [ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ]; then
  echo "▶ Configuring Google Identity Provider..."

  # Check if Google IDP exists
  GOOGLE_IDP_EXISTS=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${TOKEN}" \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/identity-provider/instances/google")

  if [ "$GOOGLE_IDP_EXISTS" = "200" ]; then
    echo "  ✔ Google Identity Provider already exists, updating..."
    curl -sf -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/identity-provider/instances/google" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"alias\": \"google\",
        \"providerId\": \"google\",
        \"enabled\": true,
        \"trustEmail\": true,
        \"storeToken\": false,
        \"addReadTokenRoleOnCreate\": false,
        \"firstBrokerLoginFlowAlias\": \"first broker login\",
        \"config\": {
          \"clientId\": \"${GOOGLE_CLIENT_ID}\",
          \"clientSecret\": \"${GOOGLE_CLIENT_SECRET}\",
          \"defaultScope\": \"openid email profile\",
          \"syncMode\": \"IMPORT\"
        }
      }"
  else
    curl -sf -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/identity-provider/instances" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"alias\": \"google\",
        \"providerId\": \"google\",
        \"enabled\": true,
        \"trustEmail\": true,
        \"storeToken\": false,
        \"addReadTokenRoleOnCreate\": false,
        \"firstBrokerLoginFlowAlias\": \"first broker login\",
        \"config\": {
          \"clientId\": \"${GOOGLE_CLIENT_ID}\",
          \"clientSecret\": \"${GOOGLE_CLIENT_SECRET}\",
          \"defaultScope\": \"openid email profile\",
          \"syncMode\": \"IMPORT\"
        }
      }"
  fi
  echo "  ✔ Google Identity Provider configured"
else
  echo "  ⏭ Google Identity Provider skipped (no credentials provided)"
  echo "    Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.prod to enable"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Keycloak Initialization Complete ✔                ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Realm:    ${REALM}"
echo "║  Client:   ${CLIENT_ID}"
echo "║  Console:  ${KEYCLOAK_URL}/admin"
echo "║  OIDC:     ${KEYCLOAK_URL}/realms/${REALM}/.well-known/openid-configuration"
echo "╚══════════════════════════════════════════════════════════╝"
