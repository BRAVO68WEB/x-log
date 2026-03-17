import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "011_media";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createType("asset_type")
    .asEnum(["banner", "post_attachment"])
    .execute();

  await db.schema
    .createTable("media")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("filename", "varchar(500)", (col) => col.notNull())
    .addColumn("url", "varchar(1000)", (col) => col.notNull().unique())
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("asset_type", sql`asset_type`, (col) =>
      col.notNull().defaultTo("post_attachment")
    )
    .addColumn("post_id", "varchar(255)", (col) =>
      col.references("posts.id").onDelete("set null")
    )
    .addColumn("size", "integer", (col) => col.notNull())
    .addColumn("mime_type", "varchar(100)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("media_user_id_idx")
    .on("media")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("media_post_id_idx")
    .on("media")
    .column("post_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("media").execute();
  await db.schema.dropType("asset_type").execute();
}
