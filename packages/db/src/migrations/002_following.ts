import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "002_following";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("following")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("local_user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("remote_actor", "varchar(500)", (col) => col.notNull())
    .addColumn("inbox_url", "varchar(500)", (col) => col.notNull())
    .addColumn("activity_id", "varchar(500)", (col) => col.notNull())
    .addColumn("accepted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("following_local_user_id_remote_actor_unique", [
      "local_user_id",
      "remote_actor",
    ])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("following").execute();
}
