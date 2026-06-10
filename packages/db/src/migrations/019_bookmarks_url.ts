import type { Kysely } from "kysely";

export const name = "019_bookmarks_url";

export async function up(db: Kysely<unknown>): Promise<void> {
 // Add url and post_title columns to bookmarks for remote post bookmarks
 await db.schema
 .alterTable("bookmarks")
 .addColumn("url", "text")
 .addColumn("post_title", "text")
 .execute();

 // Make post_id nullable (it's still required for local posts)
 await db.schema
 .alterTable("bookmarks")
 .alterColumn("post_id", (col) => col.dropNotNull())
 .execute();

 // Create index for url bookmarks
 await db.schema
 .createIndex("bookmarks_user_url_idx")
 .on("bookmarks")
 .columns(["user_id", "url"])
 .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
 await db.schema.dropIndex("bookmarks_user_url_idx").execute();
 await db.schema
 .alterTable("bookmarks")
 .alterColumn("post_id", (col) => col.setNotNull())
 .execute();
 await db.schema.alterTable("bookmarks").dropColumn("url").execute();
 await db.schema.alterTable("bookmarks").dropColumn("post_title").execute();
}
