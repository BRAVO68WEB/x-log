import { Hono } from "hono";
import { mcpAuthMiddleware, requireMCPAuth } from "../middleware/mcp-auth";
import { callMcpTool, listMcpTools } from "../mcp/tools";
import { isMcpEnabled } from "../mcp/context";

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Legacy JSON-RPC 2.0 MCP handler (POST body protocol).
 * Prefer Streamable HTTP at GET/POST /mcp for Cursor / Claude.
 */
export const mcpLegacyRoutes = new Hono();

mcpLegacyRoutes.post("/", mcpAuthMiddleware, requireMCPAuth, async (c) => {
  if (!isMcpEnabled()) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized", data: "MCP disabled" },
        id: null,
      } as MCPResponse,
      503
    );
  }

  try {
    let body: MCPRequest;
    try {
      body = (await c.req.json()) as MCPRequest;
    } catch {
      return c.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
            data: "Invalid JSON in request body",
          },
          id: null,
        } as MCPResponse,
        400
      );
    }

    if (body.jsonrpc !== "2.0" || !body.method || body.id === undefined) {
      return c.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Invalid Request",
            data: "Request must be valid JSON-RPC 2.0 with jsonrpc='2.0', method, and id fields",
          },
          id: body.id ?? null,
        } as MCPResponse,
        400
      );
    }

    const { method, params, id } = body;
    const auth = c.get("mcpAuth")!;
    const ctx = { apiKey: auth.apiKey, actor: auth.actor };
    let result: any;

    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "x-log",
            version: "1.0.0",
          },
        };
        break;

      case "notifications/initialized":
        // Client notification — acknowledge with empty result for legacy clients that wait
        result = {};
        break;

      case "tools/list":
        result = { tools: listMcpTools() };
        break;

      case "tools/call": {
        if (!params?.name) {
          return c.json(
            {
              jsonrpc: "2.0",
              error: {
                code: -32602,
                message: "Invalid params",
                data: "Tool name is required",
              },
              id,
            } as MCPResponse,
            400
          );
        }
        result = await callMcpTool(params.name, params.arguments || {}, ctx);
        break;
      }

      case "ping":
        result = { pong: true };
        break;

      default:
        return c.json(
          {
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: "Method not found",
              data: `Unknown method: ${method}`,
            },
            id,
          } as MCPResponse,
          404
        );
    }

    return c.json({
      jsonrpc: "2.0",
      id,
      result,
    } as MCPResponse);
  } catch (error) {
    console.error("MCP legacy handler error:", error);
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error",
        },
        id: null,
      } as MCPResponse,
      500
    );
  }
});

// Back-compat export name
export const mcpRoutes = mcpLegacyRoutes;
