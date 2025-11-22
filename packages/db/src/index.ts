import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "./schema";
import { getEnv } from "@xlog/config";

let db: Kysely<Database> | null = null;

export function getDb(): Kysely<Database> {
  if (!db) {
    const env = getEnv();
    const dialect = new PostgresDialect({
      pool: new Pool({
        connectionString: env.DATABASE_URL,
        max: 10,
      }),
    });

    db = new Kysely<Database>({
      dialect,
    });
  }
  return db;
}

export type { Database } from "./schema";

