import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "015_feature_flags";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create feature_flags table for database-backed feature toggles
  await db.schema
    .createTable("feature_flags")
    .addColumn("feature", "varchar(50)", (col) => col.primaryKey())
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("updated_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create index for fast lookups
  await db.schema
    .createIndex("feature_flags_enabled_idx")
    .on("feature_flags")
    .column("enabled")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("feature_flags_enabled_idx").execute();
  await db.schema.dropTable("feature_flags").execute();
}
