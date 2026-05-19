import type { Kysely } from "kysely";

export const name = "013_instance_theme";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("instance_settings")
    .addColumn("theme_id", "text", (col) =>
      col.notNull().defaultTo("system")
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("instance_settings")
    .dropColumn("theme_id")
    .execute();
}
