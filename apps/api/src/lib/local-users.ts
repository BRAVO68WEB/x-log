import { getDb } from "@xlog/db";
import { getEnv } from "@xlog/config";
import { generateKeyPairSync } from "crypto";
import bcrypt from "bcryptjs";

export async function countLocalAuthors(): Promise<number> {
  const db = getDb();
  const row = await db
    .selectFrom("users")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("role", "in", ["admin", "author"])
    .where("is_active", "=", true)
    .executeTakeFirst();
  return Number(row?.count || 0);
}

export async function assertUnderAuthorCap(): Promise<void> {
  const env = getEnv();
  const count = await countLocalAuthors();
  if (count >= env.MAX_LOCAL_AUTHORS) {
    throw new Error(
      `Local author limit reached (${env.MAX_LOCAL_AUTHORS}). Raise MAX_LOCAL_AUTHORS or deactivate a user.`
    );
  }
}

export type CreateLocalAuthorInput = {
  username: string;
  password: string;
  email?: string | null;
  role?: "author" | "admin";
  fullName?: string | null;
};

/**
 * Create a local author with profile + ActivityPub key pair.
 * Does not create a session.
 */
export async function createLocalAuthor(input: CreateLocalAuthorInput) {
  const db = getDb();
  const username = input.username.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    throw new Error("Username must be 3–32 chars: a-z, 0-9, underscore");
  }

  const { isReservedUsername } = await import("./reserved-usernames");
  if (isReservedUsername(username)) {
    throw new Error("Username is reserved");
  }

  const existing = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();
  if (existing) {
    throw new Error("Username already taken");
  }

  await assertUnderAuthorCap();

  const settings = await db
    .selectFrom("instance_settings")
    .select("instance_domain")
    .where("id", "=", 1)
    .executeTakeFirst();
  if (!settings) {
    throw new Error("Instance not onboarded");
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const role = input.role ?? "author";

  await db
    .insertInto("users")
    .values({
      id: userId,
      username,
      email: input.email || null,
      password_hash: passwordHash,
      role,
      is_active: true,
    })
    .execute();

  await db
    .insertInto("user_profiles")
    .values({
      user_id: userId,
      full_name: input.fullName || null,
    })
    .execute();

  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const keyId = `https://${settings.instance_domain}/ap/users/${username}#main-key`;
  await db
    .insertInto("user_keys")
    .values({
      user_id: userId,
      public_key_pem: publicKey,
      private_key_pem: privateKey,
      key_id: keyId,
    })
    .execute();

  return {
    id: userId,
    username,
    role,
    actor_url: `https://${settings.instance_domain}/ap/users/${username}`,
  };
}
