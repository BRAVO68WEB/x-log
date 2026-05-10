import type { Kysely } from "kysely";

export const name = "012_use_profile_as_landing";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("instance_settings")
    .addColumn("use_profile_as_landing", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("instance_settings")
    .dropColumn("use_profile_as_landing")
    .execute();
}
