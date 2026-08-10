import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("federation_domain_blocks")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("domain", "text", (col) => col.notNull().unique())
    .addColumn("reason", "text")
    .addColumn("created_by", "uuid", (col) => col.references("users.id").onDelete("set null"))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("federation_domain_blocks").ifExists().execute();
}
