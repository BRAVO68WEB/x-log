import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "024_snippets";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("snippets")
    .addColumn("id", "varchar(255)", (col) => col.primaryKey())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("language", "text", (col) => col.notNull())
    .addColumn("code", "text", (col) => col.notNull())
    .addColumn("visibility", "text", (col) =>
      col.notNull().defaultTo("public")
    )
    .addColumn("current_version", "integer", (col) =>
      col.notNull().defaultTo(1)
    )
    .addColumn("fork_of", "varchar(255)", (col) =>
      col.references("snippets.id").onDelete("set null")
    )
    .addColumn("tags", sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn("view_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createTable("snippet_versions")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("snippet_id", "varchar(255)", (col) =>
      col.notNull().references("snippets.id").onDelete("cascade")
    )
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("code", "text", (col) => col.notNull())
    .addColumn("changelog", "text")
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("snippets_user_id_idx")
    .on("snippets")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("snippets_language_idx")
    .on("snippets")
    .column("language")
    .execute();

  await db.schema
    .createIndex("snippets_created_at_idx")
    .on("snippets")
    .column("created_at")
    .execute();

  await db.schema
    .createIndex("snippet_versions_snippet_id_idx")
    .on("snippet_versions")
    .column("snippet_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("snippet_versions_snippet_id_idx").execute();
  await db.schema.dropIndex("snippets_created_at_idx").execute();
  await db.schema.dropIndex("snippets_language_idx").execute();
  await db.schema.dropIndex("snippets_user_id_idx").execute();
  await db.schema.dropTable("snippet_versions").execute();
  await db.schema.dropTable("snippets").execute();
}
