#!/usr/bin/env bash
# Lightweight API smoke checks against a running x-log API.
# Does not require auth, DB fixtures, or the web app.
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
  code=$(curl -sS -o /tmp/xlog-smoke-body.txt -w "%{http_code}" --connect-timeout 3 "${API_URL}${path}" 2>/dev/null) || true
  if [[ -z "$code" ]]; then
    code="000"
  fi
  if [[ "$code" == "$want" ]]; then
    ok "$label (HTTP $code)"
  else
    bad "$label (expected HTTP $want, got $code)"
    if [[ -s /tmp/xlog-smoke-body.txt ]]; then
      head -c 200 /tmp/xlog-smoke-body.txt
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

# Public auth status should not require session
code=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 3 "${API_URL}/api/auth/registration-status" 2>/dev/null) || true
if [[ -z "$code" ]]; then code="000"; fi
if [[ "$code" == "200" ]]; then
  ok "GET /api/auth/registration-status"
else
  bad "GET /api/auth/registration-status (HTTP $code)"
fi

echo ""
echo "Passed: $PASS  Failed: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
echo "All smoke checks passed."
