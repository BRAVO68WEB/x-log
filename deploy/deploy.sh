#!/usr/bin/env bash
set -euo pipefail

# x-log pre-deploy validation script
# Run this before deploying to verify your environment is correctly configured.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

errors=0
warnings=0

check_required() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo -e "${RED}✗${NC} $name is not set"
    ((errors++))
  else
    echo -e "${GREEN}✓${NC} $name is set"
  fi
}

check_optional() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo -e "${YELLOW}⚠${NC} $name is not set (optional)"
    ((warnings++))
  else
    echo -e "${GREEN}✓${NC} $name is set"
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " x-log deploy pre-flight check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Load .env if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo -e "${GREEN}✓${NC} .env file loaded"
else
  echo -e "${YELLOW}⚠${NC} No .env file found (using environment variables)"
fi

echo ""

# Required variables
echo "── Required ──"
check_required "DATABASE_URL" "${DATABASE_URL:-}"
check_required "SESSION_SECRET" "${SESSION_SECRET:-}"
check_required "INSTANCE_DOMAIN" "${INSTANCE_DOMAIN:-}"
check_required "OIDC_CLIENT_ID" "${OIDC_CLIENT_ID:-}"
check_required "OIDC_CLIENT_SECRET" "${OIDC_CLIENT_SECRET:-}"
check_required "OIDC_REDIRECT_URI" "${OIDC_REDIRECT_URI:-}"
check_required "OIDC_DISCOVERY_URL" "${OIDC_DISCOVERY_URL:-}"

echo ""

# Optional variables
echo "── Optional ──"
check_optional "REDIS_URL" "${REDIS_URL:-}"
check_optional "SMTP_URL" "${SMTP_URL:-}"
check_optional "ADMIN_EMAIL" "${ADMIN_EMAIL:-}"

echo ""

# SESSION_SECRET length check
if [ -n "${SESSION_SECRET:-}" ]; then
  len=${#SESSION_SECRET}
  if [ "$len" -lt 32 ]; then
    echo -e "${RED}✗${NC} SESSION_SECRET must be at least 32 characters (currently $len)"
    ((errors++))
  else
    echo -e "${GREEN}✓${NC} SESSION_SECRET length is valid ($len chars)"
  fi
fi

# DATABASE_URL format check
if [ -n "${DATABASE_URL:-}" ]; then
  if [[ "$DATABASE_URL" == postgres://* ]] || [[ "$DATABASE_URL" == postgresql://* ]]; then
    echo -e "${GREEN}✓${NC} DATABASE_URL format looks valid"
  else
    echo -e "${RED}✗${NC} DATABASE_URL must start with postgres:// or postgresql://"
    ((errors++))
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$errors" -gt 0 ]; then
  echo -e "${RED}✗ $errors error(s) found. Fix them before deploying.${NC}"
  exit 1
else
  echo -e "${GREEN}✓ All checks passed!${NC}"
  if [ "$warnings" -gt 0 ]; then
    echo -e "${YELLOW}  ($warnings optional setting(s) missing)${NC}"
  fi
  exit 0
fi
