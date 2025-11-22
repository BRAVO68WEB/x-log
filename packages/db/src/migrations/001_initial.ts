import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "001_initial";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create enum types
  await db.schema
    .createType("user_role")
    .asEnum(["admin", "author", "reader"])
    .execute();

  await db.schema
    .createType("post_visibility")
    .asEnum(["public", "unlisted", "private"])
    .execute();

  await db.schema
    .createType("delivery_status")
    .asEnum(["pending", "sent", "failed", "retrying"])
    .execute();

  // Users table
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("username", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("email", "varchar(255)", (col) => col.unique())
    .addColumn("password_hash", "varchar(255)")
    .addColumn("role", sql`user_role`, (col) => col.notNull().defaultTo("author"))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // User profiles table
  await db.schema
    .createTable("user_profiles")
    .addColumn("user_id", "uuid", (col) =>
      col.primaryKey().references("users.id").onDelete("cascade")
    )
    .addColumn("full_name", "varchar(255)")
    .addColumn("bio", "text")
    .addColumn("social_github", "varchar(255)")
    .addColumn("social_x", "varchar(255)")
    .addColumn("social_youtube", "varchar(255)")
    .addColumn("social_reddit", "varchar(255)")
    .addColumn("social_linkedin", "varchar(255)")
    .addColumn("social_website", "varchar(255)")
    .addColumn("support_url", "varchar(255)")
    .addColumn("support_text", "varchar(255)")
    .addColumn("avatar_url", "varchar(500)")
    .addColumn("banner_url", "varchar(500)")
    .execute();

  // User keys table
  await db.schema
    .createTable("user_keys")
    .addColumn("user_id", "uuid", (col) =>
      col.primaryKey().references("users.id").onDelete("cascade")
    )
    .addColumn("public_key_pem", "text", (col) => col.notNull())
    .addColumn("private_key_pem", "text", (col) => col.notNull())
    .addColumn("key_id", "varchar(500)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Posts table
  await db.schema
    .createTable("posts")
    .addColumn("id", "varchar(255)", (col) => col.primaryKey())
    .addColumn("author_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("title", "varchar(500)", (col) => col.notNull())
    .addColumn("banner_url", "varchar(500)")
    .addColumn("content_markdown", "text", (col) => col.notNull())
    .addColumn("content_blocks_json", "jsonb", (col) => col.notNull())
    .addColumn("summary", "text")
    .addColumn("hashtags", sql`text[]`, (col) => col.defaultTo(sql`'{}'::text[]`))
    .addColumn("like_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("published_at", "timestamp")
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("visibility", sql`post_visibility`, (col) =>
      col.notNull().defaultTo("public")
    )
    .addColumn("ap_object_id", "varchar(500)", (col) => col.notNull().unique())
    .execute();

  // Post hashtags table (normalized)
  await db.schema
    .createTable("post_hashtags")
    .addColumn("post_id", "varchar(255)", (col) =>
      col.notNull().references("posts.id").onDelete("cascade")
    )
    .addColumn("tag", "varchar(64)", (col) => col.notNull())
    .addUniqueConstraint("post_hashtags_post_id_tag_unique", ["post_id", "tag"])
    .execute();

  // Followers table
  await db.schema
    .createTable("followers")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("local_user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("remote_actor", "varchar(500)", (col) => col.notNull())
    .addColumn("inbox_url", "varchar(500)", (col) => col.notNull())
    .addColumn("approved", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addUniqueConstraint("followers_local_user_id_remote_actor_unique", [
      "local_user_id",
      "remote_actor",
    ])
    .execute();

  // Deliveries table
  await db.schema
    .createTable("deliveries")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("activity_id", "varchar(500)", (col) => col.notNull())
    .addColumn("remote_inbox", "varchar(500)", (col) => col.notNull())
    .addColumn("status", sql`delivery_status`, (col) => col.notNull().defaultTo("pending"))
    .addColumn("attempt_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("last_error", "text")
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Inbox objects table
  await db.schema
    .createTable("inbox_objects")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("type", "varchar(100)", (col) => col.notNull())
    .addColumn("actor", "varchar(500)", (col) => col.notNull())
    .addColumn("object_id", "varchar(500)", (col) => col.notNull())
    .addColumn("raw", "jsonb", (col) => col.notNull())
    .addColumn("received_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Instance settings table
  await db.schema
    .createTable("instance_settings")
    .addColumn("id", "integer", (col) => col.primaryKey().defaultTo(1))
    .addColumn("instance_name", "varchar(255)", (col) => col.notNull())
    .addColumn("instance_description", "text")
    .addColumn("instance_domain", "varchar(255)", (col) => col.notNull())
    .addColumn("open_registrations", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("admin_email", "varchar(255)")
    .addColumn("smtp_url", "varchar(500)")
    .addColumn("federation_enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create indexes
  await db.schema.createIndex("posts_author_id_published_at_idx").on("posts").columns(["author_id", "published_at"]).execute();
  
  await db.schema
    .createIndex("posts_content_markdown_fts_idx")
    .on("posts")
    .using("gin")
    .expression(sql`to_tsvector('english', title || ' ' || content_markdown)`)
    .execute();

  await db.schema
    .createIndex("posts_hashtags_gin_idx")
    .on("posts")
    .using("gin")
    .column("hashtags")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("inbox_objects").execute();
  await db.schema.dropTable("deliveries").execute();
  await db.schema.dropTable("followers").execute();
  await db.schema.dropTable("post_hashtags").execute();
  await db.schema.dropTable("posts").execute();
  await db.schema.dropTable("user_keys").execute();
  await db.schema.dropTable("user_profiles").execute();
  await db.schema.dropTable("users").execute();
  await db.schema.dropTable("instance_settings").execute();
  await db.schema.dropType("delivery_status").execute();
  await db.schema.dropType("post_visibility").execute();
  await db.schema.dropType("user_role").execute();
}

