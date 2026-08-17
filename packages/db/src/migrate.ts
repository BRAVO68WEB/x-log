import { promises as fs } from "fs";
import {
  Kysely,
  Migrator,
  PostgresDialect,
  type Migration,
  type MigrationProvider,
} from "kysely";
import { Pool } from "pg";
import * as path from "path";
import { pathToFileURL } from "url";

function moduleDir(): string {
  // Bun provides import.meta.dir; Node uses import.meta.url
  const meta = import.meta as ImportMeta & { dir?: string; path?: string };
  if (meta.dir) return meta.dir;
  if (typeof __dirname !== "undefined") return __dirname;
  return path.dirname(new URL(import.meta.url).pathname);
}

async function resolveMigrationsFolder(): Promise<string> {
  const dir = moduleDir();
  const candidates = [
    path.join(dir, "migrations"), // packages/db/src/migrations (normal)
    path.join(dir, "src", "migrations"),
    path.join(dir, "..", "src", "migrations"),
  ];

  for (const candidate of candidates) {
    try {
      const st = await fs.stat(candidate);
      if (!st.isDirectory()) continue;
      const files = await fs.readdir(candidate);
      if (files.some((f) => /\.(ts|js|mjs|mts)$/.test(f) && !f.endsWith(".d.ts"))) {
        return candidate;
      }
    } catch {
      /* try next */
    }
  }

  throw new Error(
    `No migrations directory with .ts/.js files found. Tried:\n` +
      candidates.map((c) => `  - ${c}`).join("\n")
  );
}

/**
 * Load migrations by **filename** (Kysely default). Never silently drop files.
 */
class StrictFileMigrationProvider implements MigrationProvider {
  constructor(private folder: string) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    const migrations: Record<string, Migration> = {};
    const files = await fs.readdir(this.folder);

    for (const fileName of files) {
      const okExt =
        (fileName.endsWith(".ts") && !fileName.endsWith(".d.ts")) ||
        fileName.endsWith(".js") ||
        fileName.endsWith(".mjs") ||
        (fileName.endsWith(".mts") && !fileName.endsWith(".d.mts"));
      if (!okExt) continue;

      const fullPath = path.join(this.folder, fileName);
      const key = fileName.substring(0, fileName.lastIndexOf("."));

      let mod: Record<string, unknown>;
      try {
        mod = await import(pathToFileURL(fullPath).href);
      } catch (err) {
        throw new Error(
          `Failed to import migration ${fileName}: ${err instanceof Error ? err.message : err}`
        );
      }

      const body = (mod as { default?: unknown }).default ?? mod;
      if (!body || typeof body !== "object" || typeof (body as Migration).up !== "function") {
        throw new Error(
          `Migration ${fileName} must export an up() function (got keys: ${Object.keys(mod).join(", ")})`
        );
      }

      if (migrations[key]) {
        throw new Error(`Duplicate migration key "${key}"`);
      }
      migrations[key] = body as Migration;
    }

    return migrations;
  }
}

async function migrateToLatest(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("Error: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  try {
    new URL(databaseUrl);
  } catch {
    console.error("Error: DATABASE_URL must be a valid URL");
    process.exit(1);
  }

  let migrationFolder: string;
  try {
    migrationFolder = await resolveMigrationsFolder();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(`[migrate] folder: ${migrationFolder}`);

  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl }),
    }),
  });

  const provider = new StrictFileMigrationProvider(migrationFolder);
  let discovered: string[] = [];
  try {
    discovered = Object.keys(await provider.getMigrations()).sort();
    console.log(`[migrate] discovered ${discovered.length}: ${discovered.join(", ")}`);
  } catch (err) {
    console.error("[migrate] discovery failed:", err);
    await db.destroy();
    process.exit(1);
  }

  const migrator = new Migrator({
    db,
    provider,
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
    try {
      const pool = new Pool({ connectionString: databaseUrl });
      const res = await pool.query<{ name: string }>(
        "select name from kysely_migration order by name"
      );
      await pool.end();
      const executed = res.rows.map((r) => r.name);
      const missing = executed.filter((n) => !discovered.includes(n));
      console.error("[migrate] DB has executed:", executed.join(", ") || "(none)");
      console.error("[migrate] discovered on disk:", discovered.join(", "));
      console.error("[migrate] missing from disk:", missing.join(", ") || "(none)");
      if (missing.length) {
        console.error(
          "[migrate] Fix: ensure these files exist under packages/db/src/migrations/ " +
            "(rebuild/redeploy image with latest git, or restore missing migration files)."
        );
      }
    } catch {
      /* ignore */
    }
    await db.destroy();
    process.exit(1);
  }

  await db.destroy();
}

// Auto-run only when executed as a script, not on import from the API
const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
const meta = import.meta as ImportMeta & { path?: string };
const self = meta.path ? path.resolve(meta.path) : "";
const isDirect = Boolean(entry && self && entry === self);

if (isDirect) {
  void migrateToLatest();
}

export { migrateToLatest };
