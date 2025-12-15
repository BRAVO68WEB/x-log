import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "005_outbox_activities";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("outbox_activities")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("activity_id", "varchar(500)", (col) => col.notNull())
    .addColumn("type", "varchar(100)", (col) => col.notNull())
    .addColumn("object_id", "varchar(500)", (col) => col.notNull())
    .addColumn("raw", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("outbox_activities_activity_id_unique", ["activity_id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("outbox_activities").execute();
}
