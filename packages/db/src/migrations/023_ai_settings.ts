import type { Kysely } from "kysely";

export const name = "023_ai_settings";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("instance_settings")
    .addColumn("ai_base_url", "text")
    .execute();

  await db.schema
    .alterTable("instance_settings")
    .addColumn("ai_api_key", "text")
    .execute();

  await db.schema
    .alterTable("instance_settings")
    .addColumn("ai_model", "text")
    .execute();

  await db.schema
    .alterTable("instance_settings")
    .addColumn("ai_max_tokens", "integer")
    .execute();

  await db.schema
    .alterTable("instance_settings")
    .addColumn("ai_temperature", "real")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("instance_settings").dropColumn("ai_temperature").execute();
  await db.schema.alterTable("instance_settings").dropColumn("ai_max_tokens").execute();
  await db.schema.alterTable("instance_settings").dropColumn("ai_model").execute();
  await db.schema.alterTable("instance_settings").dropColumn("ai_api_key").execute();
  await db.schema.alterTable("instance_settings").dropColumn("ai_base_url").execute();
}
