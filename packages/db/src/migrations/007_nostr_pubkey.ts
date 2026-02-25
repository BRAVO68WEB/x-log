import type { Kysely } from "kysely";

export const name = "007_nostr_pubkey";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("user_profiles")
    .addColumn("nostr_pubkey", "varchar(64)")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("user_profiles")
    .dropColumn("nostr_pubkey")
    .execute();
}
