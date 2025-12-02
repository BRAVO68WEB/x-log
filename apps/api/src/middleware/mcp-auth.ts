import { Context, Next } from "hono";
import { getDb } from "@xlog/db";
import { getEnv } from "@xlog/config";

export interface MCPAuthContext {
  apiKey: string;
  userId?: string;
  username?: string;
}

declare module "hono" {
  interface ContextVariableMap {
    mcpAuth?: MCPAuthContext;
  }
}

/**
 * MCP Authentication Middleware
 * Supports API key authentication via Authorization header or query parameter
 */
export async function mcpAuthMiddleware(c: Context, next: Next) {
  // Get API key from Authorization header or query parameter
  const authHeader = c.req.header("Authorization");
  let apiKey: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    apiKey = authHeader.slice(7);
  } else if (authHeader?.startsWith("mcp-key ")) {
    apiKey = authHeader.slice(8);
  } else {
    // Try query parameter
    apiKey = c.req.query("api_key");
  }

  if (!apiKey) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized",
          data: "API key required. Provide via Authorization header (Bearer <key> or mcp-key <key>) or api_key query parameter.",
        },
        id: null,
      },
      401
    );
  }

  // Validate API key
  // For now, we'll use a simple API key stored in environment variable
  // In production, you might want to store API keys in the database
  const env = getEnv();
  // Use getEnv() to get MCP_API_KEY, fallback to SESSION_SECRET
  const validApiKey = env.MCP_API_KEY || env.SESSION_SECRET;

  if (apiKey !== validApiKey) {
    // Log for debugging (remove in production)
    if (process.env.NODE_ENV === "development") {
      console.log("[MCP Auth] API key validation failed:", {
        provided: apiKey ? `${apiKey.substring(0, 4)}...` : "none",
        expected: validApiKey ? `${validApiKey.substring(0, 4)}...` : "none",
      });
    }
    // For now, only use environment variable API key
    // In the future, you could add an api_key column to users table
    // and check database for user-specific API keys here
    
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized",
          data: "Invalid API key",
        },
        id: null,
      },
      401
    );
  }

  // Valid API key
  c.set("mcpAuth", {
    apiKey,
  });

  await next();
}

/**
 * Require MCP authentication
 */
export async function requireMCPAuth(c: Context, next: Next) {
  const auth = c.get("mcpAuth");
  if (!auth) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized",
          data: "MCP authentication required",
        },
        id: null,
      },
      401
    );
  }
  await next();
}

