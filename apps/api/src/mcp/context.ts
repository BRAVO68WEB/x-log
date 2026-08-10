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
 * - MCP_ENABLED=true forces on (still needs a usable key)
 * - MCP_ENABLED=false forces off
 * - otherwise: on when MCP_API_KEY is set, or in development with SESSION_SECRET
 */
export function isMcpEnabled(): boolean {
  const env = getEnv();
  if (env.MCP_ENABLED === "false") {
    return false;
  }
  if (env.MCP_ENABLED === "true") {
    return Boolean(getMcpApiKey());
  }
  if (env.MCP_API_KEY) return true;
  // Dev-only fallback so local setups keep working without a dedicated key
  return env.NODE_ENV !== "production" && Boolean(env.SESSION_SECRET);
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
