import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "024_remote_keys";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("remote_keys")
    .addColumn("key_id", "text", (col) => col.primaryKey())
    .addColumn("owner", "text", (col) => col.notNull())
    .addColumn("public_key_pem", "text", (col) => col.notNull())
    .addColumn("fetched_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("remote_keys_owner_idx")
    .on("remote_keys")
    .column("owner")
    .execute();

  await db.schema
    .createIndex("remote_keys_fetched_at_idx")
    .on("remote_keys")
    .column("fetched_at")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("remote_keys").execute();
}
