import type { Kysely } from "kysely";
import { sql } from "kysely";

export const name = "006_oidc_accounts";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create OIDC accounts table for linking external OIDC identities to users
  await db.schema
    .createTable("oidc_accounts")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("provider", "varchar(100)", (col) => col.notNull()) // e.g., "keycloak", "auth0", "okta"
    .addColumn("provider_account_id", "varchar(255)", (col) => col.notNull()) // sub claim from OIDC
    .addColumn("email", "varchar(255)") // Email from OIDC provider
    .addColumn("email_verified", "boolean", (col) => col.defaultTo(false))
    .addColumn("name", "varchar(255)") // Display name from provider
    .addColumn("picture", "varchar(500)") // Avatar URL from provider
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addUniqueConstraint("oidc_accounts_provider_provider_account_id_unique", [
      "provider",
      "provider_account_id",
    ])
    .execute();

  // Create index for faster lookups by user_id
  await db.schema
    .createIndex("oidc_accounts_user_id_idx")
    .on("oidc_accounts")
    .column("user_id")
    .execute();

  // Create index for faster lookups by email
  await db.schema
    .createIndex("oidc_accounts_email_idx")
    .on("oidc_accounts")
    .column("email")
    .execute();

  // Create pending OIDC links table for manual account linking
  await db.schema
    .createTable("oidc_pending_links")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("state", "varchar(255)", (col) => col.notNull().unique()) // OAuth state parameter
    .addColumn("provider", "varchar(100)", (col) => col.notNull())
    .addColumn("provider_account_id", "varchar(255)", (col) => col.notNull())
    .addColumn("email", "varchar(255)")
    .addColumn("name", "varchar(255)")
    .addColumn("picture", "varchar(500)")
    .addColumn("email_verified", "boolean", (col) => col.defaultTo(false))
    .addColumn("oidc_data", "jsonb") // Store full OIDC user info for reference
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("expires_at", "timestamp", (col) => col.notNull()) // Links expire after 15 minutes
    .execute();

  // Create index for faster state lookups
  await db.schema
    .createIndex("oidc_pending_links_state_idx")
    .on("oidc_pending_links")
    .column("state")
    .execute();

  // Create index for cleanup of expired links
  await db.schema
    .createIndex("oidc_pending_links_expires_at_idx")
    .on("oidc_pending_links")
    .column("expires_at")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("oidc_pending_links").execute();
  await db.schema.dropTable("oidc_accounts").execute();
}
