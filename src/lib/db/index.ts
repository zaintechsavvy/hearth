import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

function open() {
  const file = resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "data/hearth.db");
  mkdirSync(dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof open>;

const cache = globalThis as unknown as { hearthDb?: Db };

/** One connection per server process; the global survives dev hot reloads. */
export const db = cache.hearthDb ??= open();

export function runMigrations() {
  migrate(db, { migrationsFolder: resolve(/*turbopackIgnore: true*/ process.env.MIGRATIONS_PATH ?? "drizzle") });
}
