import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "004_replay_cache";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("replay_cache")
    .addColumn("key", "varchar(500)", (col) => col.primaryKey())
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("replay_cache").execute();
}
