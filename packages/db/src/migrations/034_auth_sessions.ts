import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "034_auth_sessions";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("auth_sessions")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("token_type", "varchar(16)", (col) => col.notNull())
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .addColumn("revoked_at", "timestamp")
    .addColumn("created_at", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("auth_sessions_user_id_idx")
    .on("auth_sessions")
    .column("user_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("auth_sessions_user_id_idx").execute();
  await db.schema.dropTable("auth_sessions").execute();
}
