import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { mcpAuthMiddleware, requireMCPAuth } from "../middleware/mcp-auth";
import { createMcpServer } from "./server";
import { isMcpEnabled } from "./context";

/**
 * Streamable HTTP MCP endpoint (official transport).
 * Stateless: new transport + server per request.
 */
export const mcpStreamableRoutes = new Hono();

mcpStreamableRoutes.all("/", mcpAuthMiddleware, requireMCPAuth, async (c) => {
  if (!isMcpEnabled()) {
    return c.json({ error: "MCP disabled" }, 503);
  }

  const auth = c.get("mcpAuth")!;
  const server = createMcpServer({
    apiKey: auth.apiKey,
    actor: auth.actor,
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  await server.connect(transport);

  // Hono provides a Web Standard Request
  const response = await transport.handleRequest(c.req.raw);

  // Close after response is prepared (stateless)
  response.headers; // ensure response exists
  c.executionCtx?.waitUntil?.(
    Promise.resolve().then(async () => {
      try {
        await transport.close();
        await server.close();
      } catch {
        /* ignore */
      }
    })
  );

  // Fire-and-forget close if no executionCtx (Node)
  if (!c.executionCtx) {
    queueMicrotask(async () => {
      try {
        await transport.close();
        await server.close();
      } catch {
        /* ignore */
      }
    });
  }

  return response;
});
