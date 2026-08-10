import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("mcp_api_keys")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("name", "text", (col) => col.notNull().defaultTo("default"))
    .addColumn("key_prefix", "text", (col) => col.notNull())
    .addColumn("key_hash", "text", (col) => col.notNull().unique())
    .addColumn("scopes", "text", (col) => col.notNull().defaultTo("read_write"))
    .addColumn("last_used_at", "timestamptz")
    .addColumn("revoked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("mcp_api_keys_user_id_idx")
    .on("mcp_api_keys")
    .column("user_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("mcp_api_keys").ifExists().execute();
}
