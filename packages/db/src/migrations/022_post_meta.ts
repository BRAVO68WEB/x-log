import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "022_post_meta";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("post_meta")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("post_id", "varchar(255)", (col) =>
      col.notNull().references("posts.id").onDelete("cascade")
    )
    .addColumn("key", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addUniqueConstraint("post_meta_post_id_key_unique", ["post_id", "key"])
    .execute();

  await db.schema
    .createIndex("post_meta_post_id_idx")
    .on("post_meta")
    .column("post_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("post_meta_post_id_idx").execute();
  await db.schema.dropTable("post_meta").execute();
}
