#!/usr/bin/env bash
set -euo pipefail

# E2E Federation Compatibility Test Script
# Tests all Fediverse/ActivityPub endpoints for compatibility

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0
TOTAL=0

USERNAME=""
DOMAIN=""
SCHEME="https"

usage() {
  cat <<EOF
Usage: $(basename "$0") --username <user> --domain <domain> [--http]

E2E federation compatibility test for x-log instances.

Options:
  --username, -u   Username to test (required)
  --domain, -d     Domain of the instance (required)
  --http           Use http instead of https
  --help, -h       Show this help message

Example:
  $(basename "$0") --username bravo68web --domain example.com
  $(basename "$0") -u bravo68web -d example.trycloudflare.com
EOF
  exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --username|-u) USERNAME="$2"; shift 2 ;;
    --domain|-d) DOMAIN="$2"; shift 2 ;;
    --http) SCHEME="http"; shift ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$USERNAME" || -z "$DOMAIN" ]]; then
  echo "Error: --username and --domain are required"
  echo ""
  usage
fi

BASE_URL="${SCHEME}://${DOMAIN}"

# Check dependencies
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not found in PATH"
    exit 1
  fi
done

HAS_FEDIFY=false
if command -v fedify &>/dev/null; then
  HAS_FEDIFY=true
fi

# Test helpers
pass() {
  PASSED=$((PASSED + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${GREEN}PASS${NC} $1"
}

fail() {
  FAILED=$((FAILED + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${RED}FAIL${NC} $1"
}

skip() {
  SKIPPED=$((SKIPPED + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${YELLOW}SKIP${NC} $1"
}

header() {
  echo ""
  echo -e "${CYAN}${BOLD}[$1] $2${NC}"
}

# Fetch helper — writes body to BODY, sets HTTP_CODE
HTTP_CODE="000"
BODY=""
FETCH_TMP=$(mktemp)

fetch() {
  local url="$1"
  shift
  HTTP_CODE=$(curl -s -o "$FETCH_TMP" -w "%{http_code}" "$@" "$url" 2>/dev/null) || HTTP_CODE="000"
  BODY=$(cat "$FETCH_TMP")
}

fetch_ap() {
  fetch "$1" -H "Accept: application/activity+json"
}

cleanup() { rm -f "$FETCH_TMP"; }
trap cleanup EXIT

echo -e "${BOLD}=== x-log Federation E2E Tests ===${NC}"
echo -e "Instance: ${BASE_URL}"
echo -e "User:     ${USERNAME}@${DOMAIN}"
echo ""

# -------------------------------------------------------------------
# 1. WebFinger
# -------------------------------------------------------------------
header 1 "WebFinger"
fetch "${BASE_URL}/.well-known/webfinger?resource=acct:${USERNAME}@${DOMAIN}"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

SELF_HREF=$(echo "$BODY" | jq -r '.links[]? | select(.rel=="self" and .type=="application/activity+json") | .href' 2>/dev/null)
if [[ -n "$SELF_HREF" && "$SELF_HREF" != "null" ]]; then
  pass "Has 'self' link with application/activity+json (${SELF_HREF})"
else
  fail "Missing 'self' link with application/activity+json"
fi

# -------------------------------------------------------------------
# 2. NodeInfo Discovery
# -------------------------------------------------------------------
header 2 "NodeInfo Discovery"
fetch "${BASE_URL}/.well-known/nodeinfo"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

NI_21_HREF=$(echo "$BODY" | jq -r '.links[]? | select(.rel=="http://nodeinfo.diaspora.software/ns/schema/2.1") | .href' 2>/dev/null)
if [[ -n "$NI_21_HREF" && "$NI_21_HREF" != "null" ]]; then
  pass "Has link for schema/2.1 (${NI_21_HREF})"
else
  fail "Missing link for schema/2.1"
fi

NI_20_HREF=$(echo "$BODY" | jq -r '.links[]? | select(.rel=="http://nodeinfo.diaspora.software/ns/schema/2.0") | .href' 2>/dev/null)
if [[ -n "$NI_20_HREF" && "$NI_20_HREF" != "null" ]]; then
  pass "Has link for schema/2.0 (${NI_20_HREF})"
else
  fail "Missing link for schema/2.0"
fi

# -------------------------------------------------------------------
# 3. NodeInfo 2.1
# -------------------------------------------------------------------
header 3 "NodeInfo 2.1"
fetch "${BASE_URL}/nodeinfo/2.1"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

VERSION=$(echo "$BODY" | jq -r '.version' 2>/dev/null)
if [[ "$VERSION" == "2.1" ]]; then
  pass "version is \"2.1\""
else
  fail "Expected version \"2.1\", got \"${VERSION}\""
fi

SW_NAME=$(echo "$BODY" | jq -r '.software.name' 2>/dev/null)
if [[ -n "$SW_NAME" && "$SW_NAME" != "null" ]]; then
  pass "Has software.name (${SW_NAME})"
else
  fail "Missing software.name"
fi

PROTOCOLS=$(echo "$BODY" | jq -r '.protocols[]?' 2>/dev/null)
if echo "$PROTOCOLS" | grep -q "activitypub"; then
  pass "protocols includes activitypub"
else
  fail "protocols does not include activitypub"
fi

USERS_TOTAL=$(echo "$BODY" | jq -r '.usage.users.total' 2>/dev/null)
if [[ "$USERS_TOTAL" =~ ^[0-9]+$ ]] && [[ "$USERS_TOTAL" -ge 1 ]]; then
  pass "usage.users.total >= 1 (${USERS_TOTAL})"
else
  fail "usage.users.total < 1 or missing (${USERS_TOTAL})"
fi

SW_REPO=$(echo "$BODY" | jq -r '.software.repository' 2>/dev/null)
if [[ -n "$SW_REPO" && "$SW_REPO" != "null" ]]; then
  pass "Has software.repository (${SW_REPO})"
else
  fail "Missing software.repository (2.1-specific field)"
fi

# -------------------------------------------------------------------
# 4. NodeInfo 2.0
# -------------------------------------------------------------------
header 4 "NodeInfo 2.0"
fetch "${BASE_URL}/nodeinfo/2.0"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

VERSION=$(echo "$BODY" | jq -r '.version' 2>/dev/null)
if [[ "$VERSION" == "2.0" ]]; then
  pass "version is \"2.0\""
else
  fail "Expected version \"2.0\", got \"${VERSION}\""
fi

PROTOCOLS=$(echo "$BODY" | jq -r '.protocols[]?' 2>/dev/null)
if echo "$PROTOCOLS" | grep -q "activitypub"; then
  pass "protocols includes activitypub"
else
  fail "protocols does not include activitypub"
fi

# -------------------------------------------------------------------
# 5. Actor Object
# -------------------------------------------------------------------
header 5 "Actor Object"
fetch_ap "${BASE_URL}/ap/users/${USERNAME}"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

for field in id inbox outbox publicKey url; do
  VAL=$(echo "$BODY" | jq -r ".${field}" 2>/dev/null)
  if [[ -n "$VAL" && "$VAL" != "null" ]]; then
    pass "Has ${field}"
  else
    fail "Missing ${field}"
  fi
done

SHARED_INBOX=$(echo "$BODY" | jq -r '.endpoints.sharedInbox' 2>/dev/null)
if [[ -n "$SHARED_INBOX" && "$SHARED_INBOX" != "null" ]]; then
  pass "Has endpoints.sharedInbox (${SHARED_INBOX})"
else
  fail "Missing endpoints.sharedInbox"
fi

# -------------------------------------------------------------------
# 6. Outbox Collection
# -------------------------------------------------------------------
header 6 "Outbox Collection"
fetch_ap "${BASE_URL}/ap/users/${USERNAME}/outbox"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

OTYPE=$(echo "$BODY" | jq -r '.type' 2>/dev/null)
if [[ "$OTYPE" == "OrderedCollection" ]]; then
  pass "type is OrderedCollection"
else
  fail "Expected type OrderedCollection, got ${OTYPE}"
fi

for field in totalItems first last; do
  VAL=$(echo "$BODY" | jq -r ".${field}" 2>/dev/null)
  if [[ -n "$VAL" && "$VAL" != "null" ]]; then
    pass "Has ${field}"
  else
    fail "Missing ${field}"
  fi
done

OUTBOX_TOTAL=$(echo "$BODY" | jq -r '.totalItems' 2>/dev/null)

# -------------------------------------------------------------------
# 7. Outbox Page
# -------------------------------------------------------------------
header 7 "Outbox Page"
fetch_ap "${BASE_URL}/ap/users/${USERNAME}/outbox?page=1"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

OTYPE=$(echo "$BODY" | jq -r '.type' 2>/dev/null)
if [[ "$OTYPE" == "OrderedCollectionPage" ]]; then
  pass "type is OrderedCollectionPage"
else
  fail "Expected type OrderedCollectionPage, got ${OTYPE}"
fi

HAS_ITEMS=$(echo "$BODY" | jq 'has("orderedItems")' 2>/dev/null)
if [[ "$HAS_ITEMS" == "true" ]]; then
  pass "Has orderedItems array"
else
  fail "Missing orderedItems array"
fi

# Save first post ID for content negotiation tests
FIRST_POST_AP_ID=$(echo "$BODY" | jq -r '.orderedItems[0].object.id // .orderedItems[0].id // empty' 2>/dev/null)

# -------------------------------------------------------------------
# 8. Followers Collection
# -------------------------------------------------------------------
header 8 "Followers Collection"
fetch_ap "${BASE_URL}/ap/users/${USERNAME}/followers"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

OTYPE=$(echo "$BODY" | jq -r '.type' 2>/dev/null)
if [[ "$OTYPE" == "OrderedCollection" ]]; then
  pass "type is OrderedCollection"
else
  fail "Expected type OrderedCollection, got ${OTYPE}"
fi

HAS_TOTAL=$(echo "$BODY" | jq 'has("totalItems")' 2>/dev/null)
if [[ "$HAS_TOTAL" == "true" ]]; then
  pass "Has totalItems"
else
  fail "Missing totalItems"
fi

# -------------------------------------------------------------------
# 9. Following Collection
# -------------------------------------------------------------------
header 9 "Following Collection"
fetch_ap "${BASE_URL}/ap/users/${USERNAME}/following"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

OTYPE=$(echo "$BODY" | jq -r '.type' 2>/dev/null)
if [[ "$OTYPE" == "OrderedCollection" ]]; then
  pass "type is OrderedCollection"
else
  fail "Expected type OrderedCollection, got ${OTYPE}"
fi

HAS_TOTAL=$(echo "$BODY" | jq 'has("totalItems")' 2>/dev/null)
if [[ "$HAS_TOTAL" == "true" ]]; then
  pass "Has totalItems"
else
  fail "Missing totalItems"
fi

# -------------------------------------------------------------------
# 10. Shared Inbox
# -------------------------------------------------------------------
header 10 "Shared Inbox"
fetch "${BASE_URL}/ap/inbox" -X POST -H "Content-Type: application/activity+json" -d '{}'
if [[ "$HTTP_CODE" != "404" ]]; then
  pass "Non-404 response (got ${HTTP_CODE})"
else
  fail "Got 404 — shared inbox route not found"
fi

# -------------------------------------------------------------------
# 11. Content Negotiation (ActivityPub)
# -------------------------------------------------------------------
header 11 "Content Negotiation (ActivityPub)"
if [[ -n "$FIRST_POST_AP_ID" ]]; then
  # Extract post ID from AP URL — try /ap/posts/{id} or /post/{id} patterns
  POST_ID=$(echo "$FIRST_POST_AP_ID" | grep -oE '[^/]+$')
  if [[ -n "$POST_ID" ]]; then
    fetch_ap "${BASE_URL}/post/${POST_ID}"
    if [[ "$HTTP_CODE" == "200" ]]; then
      pass "Status 200"
      AP_TYPE=$(echo "$BODY" | jq -r '.type' 2>/dev/null)
      if [[ "$AP_TYPE" == "Article" || "$AP_TYPE" == "Note" ]]; then
        pass "Returns ActivityPub object (type: ${AP_TYPE})"
      else
        fail "Expected Article or Note type, got ${AP_TYPE}"
      fi
    else
      fail "Expected 200, got ${HTTP_CODE}"
    fi
  else
    skip "Could not extract post ID from outbox"
  fi
else
  if [[ "$OUTBOX_TOTAL" == "0" ]]; then
    skip "No posts in outbox — skipping content negotiation"
  else
    skip "Could not find post ID in outbox items"
  fi
fi

# -------------------------------------------------------------------
# 12. Content Negotiation (HTML)
# -------------------------------------------------------------------
header 12 "Content Negotiation (HTML)"
if [[ -n "$FIRST_POST_AP_ID" ]]; then
  POST_ID=$(echo "$FIRST_POST_AP_ID" | grep -oE '[^/]+$')
  if [[ -n "$POST_ID" ]]; then
    fetch "${BASE_URL}/post/${POST_ID}" -H "Accept: text/html"
    if [[ "$HTTP_CODE" == "200" ]]; then
      pass "Status 200"
    else
      fail "Expected 200, got ${HTTP_CODE}"
    fi
  else
    skip "Could not extract post ID from outbox"
  fi
else
  if [[ "$OUTBOX_TOTAL" == "0" ]]; then
    skip "No posts in outbox — skipping content negotiation"
  else
    skip "Could not find post ID in outbox items"
  fi
fi

# -------------------------------------------------------------------
# 13. Host-Meta XML
# -------------------------------------------------------------------
header 13 "Host-Meta XML"
fetch "${BASE_URL}/.well-known/host-meta"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

if echo "$BODY" | grep -q '<Link rel="lrdd"'; then
  pass "Contains <Link rel=\"lrdd\""
else
  fail "Missing <Link rel=\"lrdd\" in response"
fi

# -------------------------------------------------------------------
# 14. Host-Meta JSON
# -------------------------------------------------------------------
header 14 "Host-Meta JSON"
fetch "${BASE_URL}/.well-known/host-meta.json"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Status 200"
else
  fail "Expected 200, got ${HTTP_CODE}"
fi

HAS_LINKS=$(echo "$BODY" | jq 'has("links")' 2>/dev/null)
if [[ "$HAS_LINKS" == "true" ]]; then
  pass "Has links array"
else
  fail "Missing links array"
fi

# -------------------------------------------------------------------
# 15-17. Fedify CLI tests (optional)
# -------------------------------------------------------------------
header 15 "Fedify Lookup (optional)"
if [[ "$HAS_FEDIFY" == "true" ]]; then
  if fedify lookup "@${USERNAME}@${DOMAIN}" &>/dev/null; then
    pass "fedify lookup succeeded"
  else
    fail "fedify lookup failed"
  fi
else
  skip "fedify CLI not in PATH"
fi

header 16 "Fedify WebFinger (optional)"
if [[ "$HAS_FEDIFY" == "true" ]]; then
  if fedify webfinger "@${USERNAME}@${DOMAIN}" &>/dev/null; then
    pass "fedify webfinger succeeded"
  else
    fail "fedify webfinger failed"
  fi
else
  skip "fedify CLI not in PATH"
fi

header 17 "Fedify NodeInfo (optional)"
if [[ "$HAS_FEDIFY" == "true" ]]; then
  if fedify nodeinfo "${DOMAIN}" &>/dev/null; then
    pass "fedify nodeinfo succeeded"
  else
    fail "fedify nodeinfo failed"
  fi
else
  skip "fedify CLI not in PATH"
fi

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
echo ""
echo -e "${BOLD}=== Summary ===${NC}"
echo -e "  ${GREEN}Passed:${NC}  ${PASSED}"
echo -e "  ${RED}Failed:${NC}  ${FAILED}"
echo -e "  ${YELLOW}Skipped:${NC} ${SKIPPED}"
echo -e "  Total:   ${TOTAL}"
echo ""

if [[ "$FAILED" -gt 0 ]]; then
  echo -e "${RED}${BOLD}Some tests failed.${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}All tests passed!${NC}"
  exit 0
fi
