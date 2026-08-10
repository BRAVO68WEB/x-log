import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "033_post_versions";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("posts")
    .addColumn("current_version", "integer", (col) => col.notNull().defaultTo(1))
    .execute();

  await db.schema
    .createTable("post_versions")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("post_id", "varchar(255)", (col) =>
      col.notNull().references("posts.id").onDelete("cascade")
    )
    .addColumn("version", "integer", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("content_markdown", "text", (col) => col.notNull())
    .addColumn("content_blocks_json", "jsonb", (col) => col.notNull())
    .addColumn("summary", "text")
    .addColumn("banner_url", "text")
    .addColumn("hashtags", sql`text[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn("changelog", "text")
    .addColumn("created_by", "uuid", (col) => col.references("users.id").onDelete("set null"))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  await db.schema
    .createIndex("post_versions_post_id_idx")
    .on("post_versions")
    .column("post_id")
    .execute();

  await db.schema
    .createIndex("post_versions_post_version_uidx")
    .unique()
    .on("post_versions")
    .columns(["post_id", "version"])
    .execute();

  // Seed version 1 from current post body so history is useful immediately
  await sql`
    INSERT INTO post_versions (
      id, post_id, version, title, content_markdown, content_blocks_json,
      summary, banner_url, hashtags, changelog, created_by, created_at
    )
    SELECT
      gen_random_uuid(),
      p.id,
      1,
      p.title,
      p.content_markdown,
      p.content_blocks_json,
      p.summary,
      p.banner_url,
      p.hashtags,
      'Initial version',
      p.author_id,
      COALESCE(p.published_at, p.updated_at, now())
    FROM posts p
    WHERE NOT EXISTS (
      SELECT 1 FROM post_versions v WHERE v.post_id = p.id
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("post_versions_post_version_uidx").execute();
  await db.schema.dropIndex("post_versions_post_id_idx").execute();
  await db.schema.dropTable("post_versions").execute();
  await db.schema.alterTable("posts").dropColumn("current_version").execute();
}
