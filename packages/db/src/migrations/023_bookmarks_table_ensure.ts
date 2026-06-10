import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "023_bookmarks_table_ensure";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create bookmarks table if it doesn't exist
  // (migration 019 adds columns to this table, but the base table may be missing)
  await sql`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
      url TEXT,
      post_title TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `.execute(db);

  await db.schema
    .createIndex("bookmarks_user_id_023_idx")
    .ifNotExists()
    .on("bookmarks")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("bookmarks_user_post_023_idx")
    .ifNotExists()
    .on("bookmarks")
    .columns(["user_id", "post_id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("bookmarks_user_post_023_idx").ifExists().execute();
  await db.schema.dropIndex("bookmarks_user_id_023_idx").ifExists().execute();
}
