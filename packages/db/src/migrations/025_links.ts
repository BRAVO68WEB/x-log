import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "025_links";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("links")
    .addColumn("id", "varchar(255)", (col) => col.primaryKey())
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("title", "text")
    .addColumn("description", "text")
    .addColumn("thumbnail", "text")
    .addColumn("og_image", "text")
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("tags", sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn("view_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("is_public", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("archived_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable("link_snapshots")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("link_id", "varchar(255)", (col) =>
      col.notNull().references("links.id").onDelete("cascade")
    )
    .addColumn("archived_url", "text")
    .addColumn("archived_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("links_user_id_idx")
    .on("links")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("links_archived_at_idx")
    .on("links")
    .column("archived_at")
    .execute();

  await db.schema
    .createIndex("link_snapshots_link_id_idx")
    .on("link_snapshots")
    .column("link_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("link_snapshots_link_id_idx").execute();
  await db.schema.dropIndex("links_archived_at_idx").execute();
  await db.schema.dropIndex("links_user_id_idx").execute();
  await db.schema.dropTable("link_snapshots").execute();
  await db.schema.dropTable("links").execute();
}
