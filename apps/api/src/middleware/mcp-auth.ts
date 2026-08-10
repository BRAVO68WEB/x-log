import { Context, Next } from "hono";
import {
  getMcpApiKey,
  isMcpEnabled,
  resolveMcpActor,
  type McpActor,
} from "../mcp/context";

export interface MCPAuthContext {
  apiKey: string;
  actor: McpActor;
}

declare module "hono" {
  interface ContextVariableMap {
    mcpAuth?: MCPAuthContext;
  }
}

function unauthorized(c: Context, data: string) {
  return c.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized",
        data,
      },
      id: null,
    },
    401
  );
}

/**
 * MCP Authentication Middleware
 * Accepts Authorization: Bearer <key> where key is either:
 * - instance MCP_API_KEY (acts as primary / MCP_ACTOR_USERNAME)
 * - per-user key (xlog_mcp_…) acting as that user only
 * Legacy: Authorization: mcp-key <key>, or ?api_key= (deprecated).
 */
export async function mcpAuthMiddleware(c: Context, next: Next) {
  if (!isMcpEnabled()) {
    return unauthorized(c, "MCP server is disabled");
  }

  const authHeader = c.req.header("Authorization");
  let apiKey: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    apiKey = authHeader.slice(7).trim();
  } else if (authHeader?.startsWith("mcp-key ")) {
    apiKey = authHeader.slice(8).trim();
  } else {
    apiKey = c.req.query("api_key") || undefined;
    if (apiKey) {
      console.warn("[MCP Auth] api_key query param is deprecated; use Authorization: Bearer");
    }
  }

  if (!apiKey) {
    return unauthorized(
      c,
      "API key required. Provide Authorization: Bearer <key> (instance MCP_API_KEY or user MCP key)"
    );
  }

  const instanceKey = getMcpApiKey();

  // 1) Instance key → primary / MCP_ACTOR_USERNAME
  if (instanceKey && apiKey === instanceKey) {
    const actor = await resolveMcpActor();
    if (!actor) {
      return c.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32002,
            message: "Misconfigured",
            data: "No MCP actor user found. Set MCP_ACTOR_USERNAME or create an admin user.",
          },
          id: null,
        },
        503
      );
    }
    c.set("mcpAuth", { apiKey, actor });
    await next();
    return;
  }

  // 2) Per-user MCP key → that user only
  try {
    const { resolveActorFromUserKey } = await import("../lib/mcp-keys");
    const resolved = await resolveActorFromUserKey(apiKey);
    if (resolved) {
      c.set("mcpAuth", { apiKey, actor: resolved.actor });
      await next();
      return;
    }
  } catch (err) {
    console.warn("[MCP Auth] user key lookup failed:", err);
  }

  return unauthorized(c, "Invalid API key");
}

export async function requireMCPAuth(c: Context, next: Next) {
  const auth = c.get("mcpAuth");
  if (!auth) {
    return unauthorized(c, "MCP authentication required");
  }
  await next();
}

/** Extract Bearer token without full middleware (for streamable checks). */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
