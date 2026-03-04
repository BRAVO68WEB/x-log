import type { Kysely } from "kysely";

export const name = "010_following_enabled";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("instance_settings")
    .addColumn("following_enabled", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("instance_settings")
    .dropColumn("following_enabled")
    .execute();
}
