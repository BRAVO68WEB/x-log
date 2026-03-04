#!/usr/bin/env bun
/**
 * Local user init script — creates an admin user + instance settings for local dev.
 *
 * Usage:
 *   bun run apps/api/scripts/init-local-user.ts
 *   bun run apps/api/scripts/init-local-user.ts --username admin --password secret123
 *
 * Environment:
 *   Reads DATABASE_URL and INSTANCE_DOMAIN from .env (via @xlog/config).
 */

import { getDb } from "@xlog/db";
import { getEnv } from "@xlog/config";
import bcrypt from "bcryptjs";
import { generateKeyPairSync } from "crypto";
import { migrateToLatest } from "@xlog/db/migrate";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  options: {
    username: { type: "string", default: "admin" },
    password: { type: "string", default: "admin123" },
    email: { type: "string", default: "admin@localhost" },
  },
});

const username = args.username!;
const password = args.password!;
const email = args.email!;

async function main() {
  const env = getEnv();
  const domain = env.INSTANCE_DOMAIN;

  console.log(`Initializing local user...`);
  console.log(`  Domain:   ${domain}`);
  console.log(`  Username: ${username}`);
  console.log(`  Email:    ${email}`);

  // Run migrations first
  await migrateToLatest();

  const db = getDb();

  // --- Instance settings (idempotent) ---
  const existingSettings = await db
    .selectFrom("instance_settings")
    .select("id")
    .where("id", "=", 1)
    .executeTakeFirst();

  if (!existingSettings) {
    await db
      .insertInto("instance_settings")
      .values({
        id: 1,
        instance_name: env.INSTANCE_NAME || "x-log",
        instance_description: "Local development instance",
        instance_domain: domain,
        open_registrations: false,
        admin_email: email,
        smtp_url: null,
        federation_enabled: true,
      })
      .execute();
    console.log("  Created instance_settings");
  } else {
    console.log("  Instance settings already exist, skipping");
  }

  // --- Admin user (idempotent) ---
  const existingUser = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (existingUser) {
    console.log(`  User "${username}" already exists (id=${existingUser.id}), skipping`);
    process.exit(0);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  await db
    .insertInto("users")
    .values({
      id: userId,
      username,
      email,
      password_hash: passwordHash,
      role: "admin",
    })
    .execute();
  console.log(`  Created user "${username}" (id=${userId})`);

  // --- User profile ---
  await db
    .insertInto("user_profiles")
    .values({ user_id: userId })
    .execute();
  console.log("  Created user_profiles row");

  // --- ActivityPub keypair ---
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const keyId = `https://${domain}/ap/users/${username}#main-key`;

  await db
    .insertInto("user_keys")
    .values({
      user_id: userId,
      public_key_pem: publicKey,
      private_key_pem: privateKey,
      key_id: keyId,
    })
    .execute();
  console.log(`  Created AP keypair (keyId=${keyId})`);

  console.log("\nDone! You can now log in with:");
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Init failed:", err);
  process.exit(1);
});
