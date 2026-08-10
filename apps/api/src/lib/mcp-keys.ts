import crypto from "crypto";
import { getDb, type McpKeyScope } from "@xlog/db";
import type { McpActor } from "../mcp/context";

export function hashMcpKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/** Generate a high-entropy key shown once: xlog_mcp_<base64url> */
export function generateMcpKey(): { raw: string; prefix: string; hash: string } {
  const raw = `xlog_mcp_${crypto.randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 16);
  return { raw, prefix, hash: hashMcpKey(raw) };
}

export async function createUserMcpKey(opts: {
  userId: string;
  name?: string;
  scopes?: McpKeyScope;
}) {
  const db = getDb();
  const { raw, prefix, hash } = generateMcpKey();
  const id = crypto.randomUUID();
  const scopes = opts.scopes || "read_write";

  await db
    .insertInto("mcp_api_keys")
    .values({
      id,
      user_id: opts.userId,
      name: (opts.name || "default").slice(0, 80),
      key_prefix: prefix,
      key_hash: hash,
      scopes,
      last_used_at: null,
      revoked_at: null,
    })
    .execute();

  return {
    id,
    name: opts.name || "default",
    key_prefix: prefix,
    scopes,
    /** Raw secret — only returned on create */
    key: raw,
    created_at: new Date().toISOString(),
  };
}

export async function listUserMcpKeys(userId: string) {
  const db = getDb();
  const rows = await db
    .selectFrom("mcp_api_keys")
    .select(["id", "name", "key_prefix", "scopes", "last_used_at", "revoked_at", "created_at"])
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .orderBy("created_at", "desc")
    .execute();

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    key_prefix: r.key_prefix,
    scopes: r.scopes,
    last_used_at: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
    created_at: new Date(r.created_at).toISOString(),
  }));
}

export async function revokeUserMcpKey(userId: string, keyId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .updateTable("mcp_api_keys")
    .set({ revoked_at: new Date() })
    .where("id", "=", keyId)
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows || 0) > 0;
}

/**
 * Resolve a presented bearer key to an MCP actor.
 * Returns null if not a known user key.
 */
export async function resolveActorFromUserKey(
  rawKey: string
): Promise<{ actor: McpActor; keyId: string; scopes: McpKeyScope } | null> {
  if (!rawKey.startsWith("xlog_mcp_")) return null;

  const db = getDb();
  const hash = hashMcpKey(rawKey);
  const row = await db
    .selectFrom("mcp_api_keys")
    .innerJoin("users", "users.id", "mcp_api_keys.user_id")
    .select([
      "mcp_api_keys.id as key_id",
      "mcp_api_keys.scopes",
      "users.id as user_id",
      "users.username",
      "users.role",
      "users.is_active",
    ])
    .where("mcp_api_keys.key_hash", "=", hash)
    .where("mcp_api_keys.revoked_at", "is", null)
    .executeTakeFirst();

  if (!row) return null;
  if (row.is_active === false) return null;
  if (row.role !== "admin" && row.role !== "author") return null;

  // Touch last_used (fire-and-forget)
  void db
    .updateTable("mcp_api_keys")
    .set({ last_used_at: new Date() })
    .where("id", "=", row.key_id)
    .execute()
    .catch(() => {});

  return {
    actor: { id: row.user_id, username: row.username, role: row.role },
    keyId: row.key_id,
    scopes: row.scopes as McpKeyScope,
  };
}
