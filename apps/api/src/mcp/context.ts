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
 * MCP_ENABLED=false forces off. Otherwise per-user keys (and MCP_API_KEY, if set)
 * are accepted. SESSION_SECRET is never an MCP credential.
 */
export function isMcpEnabled(): boolean {
  return getEnv().MCP_ENABLED !== "false";
}

export function getMcpApiKey(): string | null {
  return getEnv().MCP_API_KEY || null;
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
