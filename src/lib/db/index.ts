import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
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

/** A pool worker Next starts for side jobs, never the process that serves requests. */
export const isHelperWorker = () => process.argv.some(argument => argument.includes("jest-worker"));

const migrationsFolder = () => resolve(/*turbopackIgnore: true*/ process.env.MIGRATIONS_PATH ?? "drizzle");

/**
 * DATABASE_URL points at any Postgres (Neon, Supabase, self-hosted). Without it Hearth runs PGlite, Postgres
 * compiled to WebAssembly, in a folder on disk, which only one process may open. `next build`, and the helper
 * workers `next dev` spawns (jest-worker children), import this module too, so they get throwaway
 * in-memory databases instead of opening the folder a second time, which aborts and risks corrupting it.
 */
function connect(): Connection {
  const url = process.env.DATABASE_URL;
  if (url) {
    // prepare: false keeps transaction poolers (Supabase on port 6543, Neon's pooled host) working.
    const client = postgres(url, { prepare: false, max: 10 });
    const db = drizzlePostgres(client, { schema });
    const migrate = () => migratePostgres(db, { migrationsFolder: migrationsFolder() });
    // Serverless hosts can cold-start several instances at once; whichever loses the race finds the work done on its retry.
    return { db, migrate: () => migrate().catch(() => new Promise(done => setTimeout(done, 3000)).then(migrate)) };
  }
  const building = process.env.NEXT_PHASE === "phase-production-build" || isHelperWorker();
  if (!building && process.env.VERCEL) throw new Error("DATABASE_URL is not set. Vercel has no lasting disk, so Hearth needs a Postgres database there; see docs/vercel.md.");
  const directory = resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "data/pglite");
  if (!building) {
    mkdirSync(directory, { recursive: true });
    // PGlite lives inside this process, so a lock file here can only be left over from a run that was killed.
    rmSync(join(directory, "postmaster.pid"), { force: true });
  }
  const client = building ? new PGlite() : new PGlite(directory);
  if (!building) closeOnExit(client);
  const db = drizzlePglite(client, { schema });
  return { db: db as unknown as Db, migrate: () => migratePglite(db, { migrationsFolder: migrationsFolder() }) };
}

/** Flushes and releases the data folder when the server is stopped, so the next start opens cleanly. */
function closeOnExit(client: PGlite) {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void client.close().finally(() => process.exit(0));
    });
  }
}

const cache = globalThis as unknown as { hearthDatabase?: Connection };

/** One connection per server process; the global survives dev hot reloads. */
const connection = cache.hearthDatabase ??= connect();

export const db = connection.db;
export const runMigrations = () => connection.migrate();
