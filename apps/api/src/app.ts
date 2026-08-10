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
import { isMcpEnabled } from "./mcp/context";
import { csrfMiddleware } from "./middleware/csrf";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { mapThrownError } from "./lib/http-error";

export type CreateAppOptions = {
  /** Skip request logger (tests) */
  quiet?: boolean;
  /** Disable rate limits for deterministic tests */
  disableRateLimit?: boolean;
};

/**
 * Build the Hono application (middleware + routes).
 * Side effects (migrate, OTEL, serve) stay in `index.ts`.
 */
export function createApp(opts: CreateAppOptions = {}): Hono {
  const app = new Hono();

  if (!opts.quiet) {
    app.use("*", logger());
  }

  app.use(
    "*",
    cors({
      origin: "*",
      credentials: false,
    })
  );

  if (!opts.disableRateLimit) {
    app.use("*", rateLimitMiddleware);
  }

  app.use("/api/*", csrfMiddleware);

  if (!opts.quiet) {
    app.use("*", async (c, next) => {
      await next();
      if (c.res.status >= 400) {
        console.error(`[ERROR] ${c.req.method} ${c.req.path} - ${c.res.status}`);
      }
    });
  }

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

  app.onError((err, c) => {
    const mapped = mapThrownError(err);
    if (mapped.status >= 500 && !opts.quiet) {
      console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err);
      if (err instanceof Error && err.stack) console.error(err.stack);
    }
    return c.json(mapped.body, mapped.status as 500);
  });

  app.route("/api", apiRoutes);
  app.route("/api", adminApiRoutes);

  const mcpApp = new Hono();
  mcpApp.route("/jsonrpc", mcpLegacyRoutes);
  mcpApp.route("/", mcpStreamableRoutes);
  app.route("/mcp", mcpApp);
  app.route("/api/mcp", mcpLegacyRoutes);

  app.route("/", federationRoutes);
  app.route("/", wellKnownRoutes);
  app.route("/media", mediaRoutes);

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

  return app;
}
