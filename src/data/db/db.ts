import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../schema/schema.js";

// Load .env from project root (3 levels up from src/data/db)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle({ client: pool, schema });

/**
 * Create the target database if it doesn't exist, then run pending Drizzle
 * migrations.  Safe to call repeatedly — a no-op when everything is up to date.
 */
export async function prepareDatabase(): Promise<void> {
  const dbName = process.env.DB_NAME;
  if (!dbName) {
    throw new Error("DB_NAME environment variable is required");
  }

  // Validate the database name to prevent SQL injection.
  // CREATE DATABASE does not support parameterised identifiers.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
    throw new Error(`Invalid database name: ${dbName}`);
  }

  // Connect to the "postgres" maintenance database — the target DB may not
  // exist yet, so we cannot use the application pool for this check.
  const maintenanceUrl = process.env.DATABASE_URL!.replace(
    /\/[^/?]+(\?|$)/,
    `/postgres$1`,
  );

  const client = new Client({ connectionString: maintenanceUrl });
  try {
    await client.connect();

    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[bootstrap] Database "${dbName}" created.`);
    } else {
      console.log(`[bootstrap] Database "${dbName}" already exists.`);
    }
  } finally {
    await client.end();
  }

  // Now run pending migrations against the (guaranteed-to-exist) target DB.
  const migrationsFolder = path.resolve(__dirname, "../../../drizzle");
  console.log("[bootstrap] Running migrations…");
  await migrate(db, { migrationsFolder });
  console.log("[bootstrap] Migrations applied successfully.");
}

export type DbConnection = typeof db;

/** @deprecated Use DbConnection instead */
export type DbClient = DbConnection;
