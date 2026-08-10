import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "015_feature_flags";

const FEATURE_KEYS = [
  "code_snippets",
  "link_archive",
  "ai_writer",
  "password_reset",
  "custom_post_meta",
  "bookmarks",
  "reposts",
  "threads",
  "short_posts",
  "scheduled_posts",
  "trending",
  "analytics",
  "dms",
  "custom_themes",
];

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("feature_flags")
    .addColumn("key", "text", (col) => col.primaryKey())
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  for (const key of FEATURE_KEYS) {
    await sql`INSERT INTO feature_flags (key, enabled) VALUES (${key}, false)`.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("feature_flags").execute();
}
