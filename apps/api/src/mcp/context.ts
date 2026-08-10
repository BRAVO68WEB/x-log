import { getEnv } from "@xlog/config";
import { getDb, getPrimaryUser } from "@xlog/db";

export type McpActor = {
  id: string;
  username: string;
  role?: string;
};

export type McpToolContext = {
  actor: McpActor;
  apiKey: string;
};

/**
 * Whether MCP endpoints should be mounted/serving.
 * - MCP_ENABLED=false forces off
 * - MCP_ENABLED=true forces on (instance key and/or per-user keys)
 * - otherwise: on when MCP_API_KEY is set, or in development with SESSION_SECRET,
 *   or always available for per-user key auth (keys validated at request time)
 */
export function isMcpEnabled(): boolean {
  const env = getEnv();
  if (env.MCP_ENABLED === "false") {
    return false;
  }
  if (env.MCP_ENABLED === "true") {
    return true;
  }
  if (env.MCP_API_KEY) return true;
  // Dev-only fallback so local setups keep working without a dedicated key
  if (env.NODE_ENV !== "production" && Boolean(env.SESSION_SECRET)) return true;
  // Production without instance key: still allow per-user MCP keys
  return true;
}

export function getMcpApiKey(): string | null {
  const env = getEnv();
  if (env.MCP_API_KEY) return env.MCP_API_KEY;
  if (env.NODE_ENV !== "production") {
    return env.SESSION_SECRET;
  }
  return null;
}

export async function resolveMcpActor(): Promise<McpActor | null> {
  const env = getEnv();
  const db = getDb();

  if (env.MCP_ACTOR_USERNAME) {
    const user = await db
      .selectFrom("users")
      .select(["id", "username", "role"])
      .where("username", "=", env.MCP_ACTOR_USERNAME)
      .executeTakeFirst();
    if (user) {
      return { id: user.id, username: user.username, role: user.role };
    }
    console.warn(
      `[MCP] MCP_ACTOR_USERNAME=${env.MCP_ACTOR_USERNAME} not found; falling back to primary user`
    );
  }

  const primary = await getPrimaryUser();
  if (!primary) return null;
  return { id: primary.id, username: primary.username, role: primary.role };
}
