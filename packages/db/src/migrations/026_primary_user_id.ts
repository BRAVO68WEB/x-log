import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("instance_settings")
    .addColumn("primary_user_id", "uuid")
    .execute();

  // Backfill: oldest admin, else oldest user
  await sql`
    UPDATE instance_settings
    SET primary_user_id = (
      SELECT id FROM users
      WHERE role = 'admin'
      ORDER BY created_at ASC
      LIMIT 1
    )
    WHERE id = 1 AND primary_user_id IS NULL
  `.execute(db);

  await sql`
    UPDATE instance_settings
    SET primary_user_id = (
      SELECT id FROM users
      ORDER BY created_at ASC
      LIMIT 1
    )
    WHERE id = 1 AND primary_user_id IS NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("instance_settings").dropColumn("primary_user_id").execute();
}
