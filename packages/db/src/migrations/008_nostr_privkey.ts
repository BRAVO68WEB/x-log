import type { Kysely } from "kysely";

export const name = "008_nostr_privkey";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("user_profiles")
    .addColumn("nostr_privkey", "varchar(64)")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("user_profiles")
    .dropColumn("nostr_privkey")
    .execute();
}
