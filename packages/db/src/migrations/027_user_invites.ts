import { Kysely, sql } from "kysely";

export const name = "027_user_invites";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("is_active", "boolean", (col) => col.notNull().defaultTo(true))
    .execute();

  await db.schema
    .createTable("user_invites")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("token_hash", "text", (col) => col.notNull().unique())
    .addColumn("email", "text")
    .addColumn("role", "text", (col) => col.notNull().defaultTo("author"))
    .addColumn("invited_by", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("accepted_at", "timestamptz")
    .addColumn("accepted_user_id", "uuid", (col) => col.references("users.id").onDelete("set null"))
    .addColumn("revoked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("user_invites_token_hash_idx")
    .on("user_invites")
    .column("token_hash")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("user_invites").ifExists().execute();
  await db.schema.alterTable("users").dropColumn("is_active").execute();
}
