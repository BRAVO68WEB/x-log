#!/usr/bin/env bash
# Quick MCP HTTP smoke: tools/list against a running API.
# Usage: MCP_URL=https://instance/mcp MCP_API_KEY=... ./scripts/smoke-mcp.sh
set -euo pipefail

MCP_URL="${MCP_URL:-http://localhost:8080/mcp}"
KEY="${MCP_API_KEY:-}"

if [[ -z "$KEY" ]]; then
  echo "Set MCP_API_KEY (or instance key)" >&2
  exit 1
fi

echo "→ POST tools/list $MCP_URL"
curl -sS -X POST "$MCP_URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | head -c 2000
echo
echo "OK (check JSON for tools array)"
