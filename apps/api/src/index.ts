import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { getEnv } from "@xlog/config";
import { apiRoutes, adminApiRoutes } from "./routes/api";
import { federationRoutes } from "./routes/federation";
import { wellKnownRoutes } from "./routes/well-known";
import { mcpRoutes } from "./routes/mcp";
import { mediaRoutes } from "./routes/media";
import { Scalar } from "@scalar/hono-api-reference";
import { openAPIRouteHandler } from "hono-openapi";
import { migrateToLatest } from "@xlog/db/migrate";

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

app.get('/docs', Scalar({ url: '/api/openapi.json',
  "defaultOpenAllTags": true,
  "expandAllModelSections": true,
  "layout": "classic",
  "expandAllResponses": true,
  "hideDarkModeToggle": true,
  "hideClientButton": false,
  "showSidebar": true,
  "showDeveloperTools": "localhost",
  "operationTitleSource": "summary",
  "theme": "fastify",
  "persistAuth": false,
  "telemetry": true,
  "isEditable": false,
  "isLoading": false,
  "hideModels": false,
  "documentDownloadType": "both",
  "hideTestRequestButton": false,
  "hideSearch": false,
  "showOperationId": false,
  "withDefaultFonts": true,
  "orderSchemaPropertiesBy": "alpha",
  "orderRequiredPropertiesFirst": true,
  "_integration": "hono",
  "default": false,
  "slug": "api-1",
  "title": "API #1" })
)

// Global error handler
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  console.error(err.stack);

  const status = "status" in err ? (err as any).status : 500;
  return c.json(
    { error: status === 500 ? "Internal server error" : err.message },
    status
  );
});

// Routes
app.route("/api", apiRoutes);
app.route("/api", adminApiRoutes);
app.route("/mcp", mcpRoutes); // MCP server at /mcp
app.route("/", federationRoutes);
app.route("/", wellKnownRoutes);
app.route("/media", mediaRoutes);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

const env = getEnv();
const port = Number(env.PORT) || 8080;

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
