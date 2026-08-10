import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("notifications")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("actor_label", "text", (col) => col.notNull())
    .addColumn("actor_url", "text")
    .addColumn("post_id", "text")
    .addColumn("body", "text")
    .addColumn("read_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("notifications_user_id_created_at_idx")
    .on("notifications")
    .columns(["user_id", "created_at"])
    .execute();

  await db.schema
    .createIndex("notifications_user_id_unread_idx")
    .on("notifications")
    .column("user_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("notifications").ifExists().execute();
}
