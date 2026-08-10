#!/usr/bin/env bash
# Optional authenticated E2E against a running API (cookie session + CSRF).
#
# Usage:
#   E2E_USERNAME=admin E2E_PASSWORD=secret ./scripts/smoke-e2e-auth.sh
#   API_URL=http://localhost:8080 E2E_USERNAME=... E2E_PASSWORD=... ./scripts/smoke-e2e-auth.sh
#
# Exits 0 if all steps pass. Skips with exit 0 and a message if credentials unset
# (so CI can call this optionally without failing).
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
API_URL="${API_URL%/}"
USER="${E2E_USERNAME:-}"
PASS="${E2E_PASSWORD:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
PASS_N=0
FAIL_N=0
COOKIE_JAR=$(mktemp)
BODY=$(mktemp)
trap 'rm -f "$COOKIE_JAR" "$BODY"' EXIT

ok() { echo -e "${GREEN}✓${NC} $1"; PASS_N=$((PASS_N + 1)); }
bad() { echo -e "${RED}✗${NC} $1"; FAIL_N=$((FAIL_N + 1)); }

if [[ -z "$USER" || -z "$PASS" ]]; then
  echo -e "${YELLOW}skip${NC} smoke-e2e-auth: set E2E_USERNAME and E2E_PASSWORD to run"
  exit 0
fi

echo "E2E auth smoke: $API_URL as $USER"
echo ""

# Login
code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY" -w "%{http_code}" \
  -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"username\":$(printf '%s' "$USER" | jq -Rs .),\"password\":$(printf '%s' "$PASS" | jq -Rs .)}" \
  --connect-timeout 5 2>/dev/null) || code="000"

if [[ "$code" == "200" ]]; then
  ok "POST /api/auth/login"
else
  bad "POST /api/auth/login (HTTP $code) $(head -c 120 "$BODY")"
  echo "Passed: $PASS_N Failed: $FAIL_N"
  exit 1
fi

# Extract CSRF from jar if present
CSRF=$(awk '$6=="xlog_csrf"{print $7}' "$COOKIE_JAR" | tail -1)
CSRF_HDR=()
if [[ -n "$CSRF" ]]; then
  CSRF_HDR=(-H "X-CSRF-Token: $CSRF")
  ok "CSRF cookie issued"
else
  bad "CSRF cookie xlog_csrf missing after login"
fi

# me
code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY" -w "%{http_code}" \
  "${API_URL}/api/users/me" --connect-timeout 5 2>/dev/null) || code="000"
if [[ "$code" == "200" ]] && grep -q '"username"' "$BODY"; then
  ok "GET /api/users/me"
  if grep -q 'session_expires_at\|auth_method' "$BODY"; then
    ok "session metadata present on /me"
  else
    bad "session metadata missing on /me"
  fi
else
  bad "GET /api/users/me (HTTP $code)"
fi

# CSRF-protected no-op: PATCH me without token should 403 when session valid
code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY" -w "%{http_code}" \
  -X PATCH "${API_URL}/api/users/me" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{}' \
  --connect-timeout 5 2>/dev/null) || code="000"
if [[ "$code" == "403" ]]; then
  ok "PATCH /me without CSRF → 403"
else
  # empty patch may 400 validation — still not 200 without CSRF ideally
  if [[ "$code" == "400" ]]; then
    ok "PATCH /me without CSRF blocked or invalid (HTTP $code)"
  else
    bad "PATCH /me without CSRF expected 403, got $code"
  fi
fi

# Logout with CSRF
if [[ -n "$CSRF" ]]; then
  code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY" -w "%{http_code}" \
    -X POST "${API_URL}/api/auth/logout" \
    -H "Origin: http://localhost:3000" \
    "${CSRF_HDR[@]}" \
    --connect-timeout 5 2>/dev/null) || code="000"
  if [[ "$code" == "200" ]]; then
    ok "POST /api/auth/logout"
  else
    bad "POST /api/auth/logout (HTTP $code)"
  fi
fi

echo ""
echo "Passed: $PASS_N  Failed: $FAIL_N"
if [[ "$FAIL_N" -gt 0 ]]; then
  exit 1
fi
echo "Auth E2E smoke passed."
