#!/usr/bin/env bash
# Lightweight API smoke checks against a running x-log API.
# Does not require auth credentials.
#
# Usage:
#   ./scripts/smoke-api.sh
#   API_URL=http://localhost:8080 ./scripts/smoke-api.sh
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
API_URL="${API_URL%/}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
PASS=0
FAIL=0
BODY_FILE=$(mktemp)
trap 'rm -f "$BODY_FILE"' EXIT

ok() {
  echo -e "${GREEN}✓${NC} $1"
  PASS=$((PASS + 1))
}

bad() {
  echo -e "${RED}✗${NC} $1"
  FAIL=$((FAIL + 1))
}

check_status() {
  local path="$1"
  local want="$2"
  local label="$3"
  local code
  code=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" --connect-timeout 3 "${API_URL}${path}" 2>/dev/null) || true
  if [[ -z "$code" ]]; then
    code="000"
  fi
  if [[ "$code" == "$want" ]]; then
    ok "$label (HTTP $code)"
  else
    bad "$label (expected HTTP $want, got $code)"
    if [[ -s "$BODY_FILE" ]]; then
      head -c 200 "$BODY_FILE"
      echo
    fi
  fi
}

echo "Smoke API: $API_URL"
echo ""

check_status "/health" "200" "GET /health"

if curl -sS --connect-timeout 3 "${API_URL}/health" 2>/dev/null | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
  ok "health JSON status=ok"
else
  bad "health JSON missing status=ok"
fi

check_status "/api/openapi.json" "200" "GET /api/openapi.json"

if curl -sS --connect-timeout 3 "${API_URL}/api/openapi.json" 2>/dev/null | grep -q '"openapi"'; then
  ok "openapi document has openapi field"
else
  bad "openapi JSON looks invalid"
fi

check_status "/docs" "200" "GET /docs (Scalar)"

check_status "/api/auth/registration-status" "200" "GET /api/auth/registration-status"

# Public posts list
code=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" --connect-timeout 3 "${API_URL}/api/posts?limit=3" 2>/dev/null) || true
[[ -z "$code" ]] && code="000"
if [[ "$code" == "200" ]] && grep -q '"items"' "$BODY_FILE" 2>/dev/null; then
  ok "GET /api/posts list shape"
else
  bad "GET /api/posts (HTTP $code)"
fi

# Unauthenticated me
code=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" --connect-timeout 3 "${API_URL}/api/users/me" 2>/dev/null) || true
[[ -z "$code" ]] && code="000"
if [[ "$code" == "401" ]]; then
  ok "GET /api/users/me unauthenticated → 401"
else
  bad "GET /api/users/me expected 401, got $code"
fi

# NodeInfo discovery (federation smoke, soft)
code=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 3 "${API_URL}/.well-known/nodeinfo" 2>/dev/null) || true
[[ -z "$code" ]] && code="000"
if [[ "$code" == "200" || "$code" == "404" ]]; then
  ok "GET /.well-known/nodeinfo reachable (HTTP $code)"
else
  bad "GET /.well-known/nodeinfo unexpected HTTP $code"
fi

echo ""
echo "Passed: $PASS  Failed: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
echo "All smoke checks passed."
