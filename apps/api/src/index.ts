import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { apiRoutes, adminApiRoutes } from "./routes/api";
import { federationRoutes } from "./routes/federation";
import { wellKnownRoutes } from "./routes/well-known";
import { mcpLegacyRoutes } from "./routes/mcp";
import { mcpStreamableRoutes } from "./mcp/streamable";
import { mediaRoutes } from "./routes/media";
import { Scalar } from "@scalar/hono-api-reference";
import { openAPIRouteHandler } from "hono-openapi";
import { migrateToLatest } from "@xlog/db/migrate";
import { getEnv } from "@xlog/config";
import { isMcpEnabled } from "./mcp/context";
import { startOtelIfEnabled } from "./lib/otel";
import { csrfMiddleware } from "./middleware/csrf";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { mapThrownError } from "./lib/http-error";

await startOtelIfEnabled();

const app = new Hono();

// Migrate the database
migrateToLatest();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    credentials: false,
  })
);
// Per-IP rate limits (global API + sensitive paths). RATE_LIMIT_ENABLED=false to disable.
app.use("*", rateLimitMiddleware);
// Cookie-session CSRF (double-submit + Origin). Skips Bearer / no-session.
app.use("/api/*", csrfMiddleware);

// Log all error responses (4xx and 5xx)
app.use("*", async (c, next) => {
  await next();
  if (c.res.status >= 400) {
    console.error(`[ERROR] ${c.req.method} ${c.req.path} - ${c.res.status}`);
  }
});

app.get(
  "/api/openapi.json",
  openAPIRouteHandler(app, {
    documentation: {
      openapi: "3.0.0",
      info: {
        title: "x-log API",
        version: "1.0.0",
      },
    },
  })
);

app.get(
  "/docs",
  Scalar({
    url: "/api/openapi.json",
    defaultOpenAllTags: true,
    expandAllModelSections: true,
    layout: "classic",
    expandAllResponses: true,
    hideDarkModeToggle: true,
    hideClientButton: false,
    showSidebar: true,
    showDeveloperTools: "localhost",
    operationTitleSource: "summary",
    theme: "fastify",
    persistAuth: false,
    telemetry: true,
    isEditable: false,
    isLoading: false,
    hideModels: false,
    documentDownloadType: "both",
    hideTestRequestButton: false,
    hideSearch: false,
    showOperationId: false,
    withDefaultFonts: true,
    orderSchemaPropertiesBy: "alpha",
    orderRequiredPropertiesFirst: true,
    _integration: "hono",
    default: false,
    slug: "api-1",
    title: "API #1",
  })
);

// Global error handler — consistent JSON for Zod / HTTPException / ApiError
app.onError((err, c) => {
  const mapped = mapThrownError(err);
  if (mapped.status >= 500) {
    console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err);
    if (err instanceof Error && err.stack) console.error(err.stack);
  } else if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[WARN] ${c.req.method} ${c.req.path} - ${mapped.status}: ${mapped.body.error}`
    );
  }
  return c.json(mapped.body, mapped.status as 500);
});

// Routes
app.route("/api", apiRoutes);
app.route("/api", adminApiRoutes);

// MCP: Streamable HTTP (primary) + nested legacy JSON-RPC under /mcp/jsonrpc
// (must nest so /mcp does not swallow /mcp/jsonrpc)
const mcpApp = new Hono();
mcpApp.route("/jsonrpc", mcpLegacyRoutes);
mcpApp.route("/", mcpStreamableRoutes);
app.route("/mcp", mcpApp);
// Legacy alias for older clients / Next path /api/mcp/jsonrpc → also on API
app.route("/api/mcp", mcpLegacyRoutes);

app.route("/", federationRoutes);
app.route("/", wellKnownRoutes);
app.route("/media", mediaRoutes);

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    mcp: {
      enabled: isMcpEnabled(),
      streamable: "/mcp",
      jsonrpc: "/mcp/jsonrpc",
    },
  });
});

const env = getEnv();
const port = Number(env.PORT) || 8080;

if (isMcpEnabled()) {
  const keySource = getEnv().MCP_API_KEY ? "MCP_API_KEY" : "SESSION_SECRET (dev only)";
  console.log(`MCP enabled (auth: ${keySource}); Streamable HTTP at /mcp, legacy at /mcp/jsonrpc`);
} else {
  console.log("MCP disabled (set MCP_API_KEY to enable)");
}

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
