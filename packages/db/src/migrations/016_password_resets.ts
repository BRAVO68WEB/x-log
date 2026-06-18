import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "016_password_resets";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("password_resets")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("token_hash", "text", (col) => col.notNull())
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .addColumn("used_at", "timestamp")
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("password_resets_token_hash_idx")
    .on("password_resets")
    .column("token_hash")
    .execute();

  await db.schema
    .createIndex("password_resets_user_id_idx")
    .on("password_resets")
    .column("user_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("password_resets_user_id_idx").execute();
  await db.schema.dropIndex("password_resets_token_hash_idx").execute();
  await db.schema.dropTable("password_resets").execute();
}
