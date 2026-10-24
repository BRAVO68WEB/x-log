import { serve } from "@hono/node-server";
import { migrateToLatest } from "@xlog/db/migrate";
import { getEnv } from "@xlog/config";
import { isMcpEnabled } from "./mcp/context";
import { startOtelIfEnabled } from "./lib/otel";
import { createApp } from "./app";

await startOtelIfEnabled();

// Migrate the database before accepting traffic
await migrateToLatest();

const app = createApp();

const env = getEnv();
const port = Number(env.PORT) || 8080;

if (isMcpEnabled()) {
  const keySource = getEnv().MCP_API_KEY ? "MCP_API_KEY" : "per-user keys only";
  console.log(`MCP enabled (auth: ${keySource}); Streamable HTTP at /mcp, legacy at /mcp/jsonrpc`);
} else {
  console.log("MCP disabled (MCP_ENABLED=false)");
}

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
