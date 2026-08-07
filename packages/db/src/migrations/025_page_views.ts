import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("posts")
    .addColumn("view_count", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .createTable("page_views")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("path", "text", (col) => col.notNull())
    .addColumn("post_id", "varchar(255)")
    .addColumn("author_id", "uuid")
    .addColumn("referrer", "text")
    .addColumn("referrer_host", "text")
    .addColumn("user_agent", "text")
    .addColumn("ip_hash", "text")
    .addColumn("ip_raw", "text")
    .addColumn("session_id", "text")
    .execute();

  await db.schema.createIndex("page_views_created_at_idx").on("page_views").column("created_at").execute();
  await db.schema.createIndex("page_views_post_id_created_at_idx").on("page_views").columns(["post_id", "created_at"]).execute();
  await db.schema.createIndex("page_views_author_id_created_at_idx").on("page_views").columns(["author_id", "created_at"]).execute();
  await db.schema.createIndex("page_views_referrer_host_idx").on("page_views").column("referrer_host").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("page_views").execute();
  await db.schema.alterTable("posts").dropColumn("view_count").execute();
}
