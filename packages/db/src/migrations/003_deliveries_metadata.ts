import type { Kysely } from "kysely";

export const name = "003_deliveries_metadata";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("deliveries")
    .addColumn("user_id", "uuid")
    .addColumn("post_id", "varchar(255)")
    .addColumn("activity_json", "jsonb")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("deliveries")
    .dropColumn("activity_json")
    .dropColumn("post_id")
    .dropColumn("user_id")
    .execute();
}
