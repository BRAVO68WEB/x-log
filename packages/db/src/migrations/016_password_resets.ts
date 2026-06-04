import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "016_password_resets";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create password_resets table for password reset tokens
  await db.schema
    .createTable("password_resets")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("token_hash", "varchar(255)", (col) => col.notNull())
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .addColumn("used_at", "timestamp")
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Index for fast token lookups
  await db.schema
    .createIndex("password_resets_token_hash_idx")
    .on("password_resets")
    .column("token_hash")
    .execute();

  // Index for cleanup of expired tokens
  await db.schema
    .createIndex("password_resets_expires_at_idx")
    .on("password_resets")
    .column("expires_at")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("password_resets_expires_at_idx").execute();
  await db.schema.dropIndex("password_resets_token_hash_idx").execute();
  await db.schema.dropTable("password_resets").execute();
}
