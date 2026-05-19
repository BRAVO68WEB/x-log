import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "014_post_likes_and_inbox_metadata";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("post_likes")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("post_id", "varchar(255)", (col) =>
      col.notNull().references("posts.id").onDelete("cascade")
    )
    .addColumn("user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade")
    )
    .addColumn("actor", "varchar(500)", (col) => col.notNull())
    .addColumn("activity_id", "varchar(500)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addUniqueConstraint("post_likes_post_id_actor_unique", [
      "post_id",
      "actor",
    ])
    .execute();

  await db.schema
    .alterTable("inbox_objects")
    .addColumn("local_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("post_likes_post_id_idx")
    .on("post_likes")
    .column("post_id")
    .execute();

  await db.schema
    .createIndex("post_likes_user_id_idx")
    .on("post_likes")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("inbox_objects_local_user_received_idx")
    .on("inbox_objects")
    .columns(["local_user_id", "received_at"])
    .execute();

  await db.schema
    .createIndex("inbox_objects_actor_received_idx")
    .on("inbox_objects")
    .columns(["actor", "received_at"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("inbox_objects_actor_received_idx").execute();
  await db.schema.dropIndex("inbox_objects_local_user_received_idx").execute();
  await db.schema.dropIndex("post_likes_user_id_idx").execute();
  await db.schema.dropIndex("post_likes_post_id_idx").execute();
  await db.schema.alterTable("inbox_objects").dropColumn("local_user_id").execute();
  await db.schema.dropTable("post_likes").execute();
}
