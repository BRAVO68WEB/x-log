import { Kysely, sql } from "kysely";

export const name = "031_scheduled_posts";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("posts")
    .addColumn("scheduled_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("posts_scheduled_at_idx")
    .on("posts")
    .column("scheduled_at")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("posts_scheduled_at_idx").ifExists().execute();
  await db.schema.alterTable("posts").dropColumn("scheduled_at").execute();
}
