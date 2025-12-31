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
    origin: (origin) => {
      // Allow all origins for federation endpoints
      if (origin?.includes("/ap/") || origin?.includes("/.well-known/")) {
        return origin;
      }
      const env = getEnv();
      // In production, restrict to your frontend domain
      if (env.NODE_ENV === "production") {
        return env.INSTANCE_DOMAIN;
      }
      return origin || "*";
    },
    credentials: true,
  })
);

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
