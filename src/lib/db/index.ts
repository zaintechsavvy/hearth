import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

/** Both drivers expose the same Drizzle query API; this is the type the app codes against. */
export type Db = PostgresJsDatabase<typeof schema>;

interface Connection {
  db: Db;
  migrate: () => Promise<void>;
}

const migrationsFolder = () => resolve(/*turbopackIgnore: true*/ process.env.MIGRATIONS_PATH ?? "drizzle");

/**
 * DATABASE_URL points at any Postgres (Neon, Supabase, self-hosted). Without it Hearth runs PGlite, Postgres
 * compiled to WebAssembly, in a folder on disk. `next build` runs many workers that import this module, so the
 * build gets throwaway in-memory databases instead of fighting over one folder.
 */
function connect(): Connection {
  const url = process.env.DATABASE_URL;
  if (url) {
    // prepare: false keeps transaction poolers (Supabase on port 6543, Neon's pooled host) working.
    const client = postgres(url, { prepare: false, max: 10 });
    const db = drizzlePostgres(client, { schema });
    return { db, migrate: () => migratePostgres(db, { migrationsFolder: migrationsFolder() }) };
  }
  const building = process.env.NEXT_PHASE === "phase-production-build";
  const directory = resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "data/pglite");
  if (!building) mkdirSync(directory, { recursive: true });
  const db = drizzlePglite(building ? new PGlite() : new PGlite(directory), { schema });
  return { db: db as unknown as Db, migrate: () => migratePglite(db, { migrationsFolder: migrationsFolder() }) };
}

const cache = globalThis as unknown as { hearthDatabase?: Connection };

/** One connection per server process; the global survives dev hot reloads. */
const connection = cache.hearthDatabase ??= connect();

export const db = connection.db;
export const runMigrations = () => connection.migrate();
