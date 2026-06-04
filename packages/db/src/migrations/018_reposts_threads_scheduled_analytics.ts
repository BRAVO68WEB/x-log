import type { Kysely } from "kysely";

export const name = "018_reposts_threads_scheduled_analytics";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add columns to posts table for new features
  await db.schema
    .alterTable("posts")
    .addColumn("repost_of", "text")
    .addColumn("thread_id", "text")
    .addColumn("thread_position", "integer")
    .addColumn("scheduled_at", "timestamp")
    .execute();

  // Threads table
  await db.schema
    .createTable("threads")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("title", "text")
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .addColumn("updated_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .execute();

  // Post views for analytics
  await db.schema
    .createTable("post_views")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("post_id", "text", (col) => col.notNull().references("posts.id").onDelete("cascade"))
    .addColumn("viewed_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .addColumn("referrer", "text")
    .addColumn("user_agent", "text")
    .execute();

  // Analytics aggregates for faster queries
  await db.schema
    .createTable("analytics_aggregates")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("date", "date", (col) => col.notNull())
    .addColumn("posts_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("views_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("likes_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("reposts_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("followers_count", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  // Trending hashtags table
  await db.schema
    .createTable("trending")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("hashtag", "text", (col) => col.notNull())
    .addColumn("score", "real", (col) => col.notNull())
    .addColumn("hour", "timestamp", (col) => col.notNull())
    .execute();

  // Indexes
  await db.schema.createIndex("posts_repost_of_idx").on("posts").column("repost_of").execute();
  await db.schema.createIndex("posts_thread_id_idx").on("posts").column("thread_id").execute();
  await db.schema
    .createIndex("posts_scheduled_at_idx")
    .on("posts")
    .column("scheduled_at")
    .execute();
  await db.schema.createIndex("threads_user_id_idx").on("threads").column("user_id").execute();
  await db.schema
    .createIndex("post_views_post_id_idx")
    .on("post_views")
    .column("post_id")
    .execute();
  await db.schema
    .createIndex("post_views_viewed_at_idx")
    .on("post_views")
    .column("viewed_at")
    .execute();
  await db.schema
    .createIndex("analytics_aggregates_user_date_idx")
    .on("analytics_aggregates")
    .columns(["user_id", "date"])
    .execute();
  await db.schema.createIndex("trending_hashtag_idx").on("trending").column("hashtag").execute();
  await db.schema.createIndex("trending_hour_idx").on("trending").column("hour").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("trending").execute();
  await db.schema.dropTable("analytics_aggregates").execute();
  await db.schema.dropTable("post_views").execute();
  await db.schema.dropTable("threads").execute();

  // Remove columns from posts
  await db.schema.alterTable("posts").dropColumn("scheduled_at").execute();
  await db.schema.alterTable("posts").dropColumn("thread_position").execute();
  await db.schema.alterTable("posts").dropColumn("thread_id").execute();
  await db.schema.alterTable("posts").dropColumn("repost_of").execute();
}
