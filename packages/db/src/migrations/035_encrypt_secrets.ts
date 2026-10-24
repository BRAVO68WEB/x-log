import type { Kysely } from "kysely";
import { sql } from "kysely";
import { encryptSecret, encryptionPrefix, parseEncryptionKey } from "@xlog/config";

export const name = "035_encrypt_secrets";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table user_profiles alter column nostr_privkey type text`.execute(db);

  const key = parseEncryptionKey(process.env.DATA_ENCRYPTION_KEY);
  if (!key) return;

  const prefix = encryptionPrefix();

  const keys = await sql<{ user_id: string; private_key_pem: string }>`
    select user_id, private_key_pem from user_keys
    where private_key_pem is not null
      and private_key_pem not like ${prefix + "%"}
  `.execute(db);

  for (const row of keys.rows) {
    const enc = encryptSecret(row.private_key_pem, key);
    await sql`update user_keys set private_key_pem = ${enc} where user_id = ${row.user_id}`.execute(
      db
    );
  }

  const nostr = await sql<{ user_id: string; nostr_privkey: string }>`
    select user_id, nostr_privkey from user_profiles
    where nostr_privkey is not null
      and nostr_privkey not like ${prefix + "%"}
  `.execute(db);

  for (const row of nostr.rows) {
    const enc = encryptSecret(row.nostr_privkey, key);
    await sql`update user_profiles set nostr_privkey = ${enc} where user_id = ${row.user_id}`.execute(
      db
    );
  }
}

export async function down(): Promise<void> {
  // Ciphertext is wider than the old varchar(64). Leave nostr_privkey as text.
}
