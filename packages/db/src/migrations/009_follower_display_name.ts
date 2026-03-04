import type { Kysely } from "kysely";

export const name = "009_follower_display_name";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("followers")
    .addColumn("remote_username", "varchar(255)")
    .execute();

  await db.schema
    .alterTable("followers")
    .addColumn("remote_domain", "varchar(255)")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("followers").dropColumn("remote_username").execute();
  await db.schema.alterTable("followers").dropColumn("remote_domain").execute();
}
