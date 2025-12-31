import { promises as fs } from "fs";
import { Kysely, Migrator, PostgresDialect, FileMigrationProvider } from "kysely";
import { Pool } from "pg";
import * as path from "path";

async function migrateToLatest() {
  // Get DATABASE_URL from env
  // Bun automatically loads .env files from project root
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("Error: DATABASE_URL environment variable is required");
    console.error("Please set DATABASE_URL in your .env file or environment");
    console.error("Example: DATABASE_URL=postgres://user:pass@localhost:5432/xlog");
    process.exit(1);
  }

  // Basic URL validation
  try {
    new URL(databaseUrl);
  } catch {
    console.error("Error: DATABASE_URL must be a valid URL");
    process.exit(1);
  }

  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: databaseUrl,
      }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "migrations"),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("Failed to migrate");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

migrateToLatest();

export {
  migrateToLatest,
}

