import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Applies drizzle/ to DATABASE_URL. Vercel runs this before each production build, because its functions can't read the migration files at run time. */
const environment = process.env.VERCEL_ENV;
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (environment && environment !== "production") {
  console.log(`Skipping migrations on a ${environment} build: previews share the production database.`);
} else if (!url) {
  console.log("Skipping migrations: DATABASE_URL is not set.");
} else {
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: process.env.MIGRATIONS_PATH ?? "drizzle" });
  await client.end();
  console.log("Migrations applied.");
}
