import type { Kysely } from "kysely";

export const name = "017_snippets_links_meta_bookmarks";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Snippets table - personal code archive
  await db.schema
    .createTable("snippets")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("language", "text", (col) => col.notNull())
    .addColumn("code", "text", (col) => col.notNull())
    .addColumn("visibility", "text", (col) => col.notNull().defaultTo("public"))
    .addColumn("current_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("fork_of", "text")
    .addColumn("tags", "text", (col) => col.defaultTo("{}"))
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .addColumn("updated_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .execute();

  // Snippet versions for history
  await db.schema
    .createTable("snippet_versions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("snippet_id", "text", (col) =>
      col.notNull().references("snippets.id").onDelete("cascade")
    )
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("code", "text", (col) => col.notNull())
    .addColumn("changelog", "text")
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .execute();

  // Links table - public link archive
  await db.schema
    .createTable("links")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("title", "text")
    .addColumn("description", "text")
    .addColumn("thumbnail", "text")
    .addColumn("og_image", "text")
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("archived_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .addColumn("views", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("is_public", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("tags", "text", (col) => col.defaultTo("{}"))
    .addColumn("archived_url", "text")
    .execute();

  // Post metadata table - custom key-value pairs
  await db.schema
    .createTable("post_meta")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("post_id", "text", (col) => col.notNull().references("posts.id").onDelete("cascade"))
    .addColumn("key", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .addColumn("updated_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .execute();

  // Bookmarks table - personal save collection
  await db.schema
    .createTable("bookmarks")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
    .addColumn("post_id", "text", (col) => col.notNull().references("posts.id").onDelete("cascade"))
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo("now"))
    .execute();

  // Indexes
  await db.schema.createIndex("snippets_user_id_idx").on("snippets").column("user_id").execute();
  await db.schema.createIndex("snippets_language_idx").on("snippets").column("language").execute();
  await db.schema
    .createIndex("snippet_versions_snippet_id_idx")
    .on("snippet_versions")
    .column("snippet_id")
    .execute();
  await db.schema.createIndex("links_user_id_idx").on("links").column("user_id").execute();
  await db.schema.createIndex("links_url_idx").on("links").column("url").execute();
  await db.schema.createIndex("post_meta_post_id_idx").on("post_meta").column("post_id").execute();
  await db.schema
    .createIndex("post_meta_post_id_key_idx")
    .on("post_meta")
    .columns(["post_id", "key"])
    .execute();
  await db.schema.createIndex("bookmarks_user_id_idx").on("bookmarks").column("user_id").execute();
  await db.schema
    .createIndex("bookmarks_user_post_idx")
    .on("bookmarks")
    .columns(["user_id", "post_id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("bookmarks").execute();
  await db.schema.dropTable("post_meta").execute();
  await db.schema.dropTable("links").execute();
  await db.schema.dropTable("snippet_versions").execute();
  await db.schema.dropTable("snippets").execute();
}
