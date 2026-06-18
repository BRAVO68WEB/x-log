import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "021_microblog_features";

export async function up(db: Kysely<unknown>): Promise<void> {
  // ── Reposts: add repost_of_id to posts ──
  await db.schema
    .alterTable("posts")
    .addColumn("repost_of_id", "varchar(255)", (col) =>
      col.references("posts.id").onDelete("set null")
    )
    .execute();

  await db.schema
    .createIndex("posts_repost_of_id_idx")
    .on("posts")
    .column("repost_of_id")
    .execute();

  // ── Short Posts: add post_type to posts ──
  await db.schema
    .alterTable("posts")
    .addColumn("post_type", "text", (col) =>
      col.notNull().defaultTo("article")
    )
    .execute();

  // ── Threads: create threads table + add thread columns to posts ──
  await db.schema
    .createTable("threads")
    .addColumn("id", "varchar(255)", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("title", "text")
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .alterTable("posts")
    .addColumn("thread_id", "varchar(255)", (col) =>
      col.references("threads.id").onDelete("set null")
    )
    .addColumn("thread_position", "integer")
    .execute();

  await db.schema
    .createIndex("posts_thread_id_idx")
    .on("posts")
    .column("thread_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("posts_thread_id_idx").execute();
  await db.schema.alterTable("posts").dropColumn("thread_position").execute();
  await db.schema.alterTable("posts").dropColumn("thread_id").execute();
  await db.schema.dropTable("threads").execute();
  await db.schema.alterTable("posts").dropColumn("post_type").execute();
  await db.schema.dropIndex("posts_repost_of_id_idx").execute();
  await db.schema.alterTable("posts").dropColumn("repost_of_id").execute();
}
