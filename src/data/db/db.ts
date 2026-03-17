import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../schema/schema.js";

// Load .env from project root (3 levels up from src/data/db)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle({ client: pool, schema });

// make sure to create the database if it doesn't exist, and then run any pending migrations. If the database already exists and is up to date, this will be a no-op.
export async function prepareDatabase(): Promise<void> {
  const client = await pool.connect();
  // IF DATABASE DOES NOT EXIST, CREATE IT
  await client.query(`
    CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}
  `);
  client.release();

  const migrationsFolder = path.resolve(__dirname, "../../../drizzle");
  await migrate(db, { migrationsFolder });
}

export type DbConnection = typeof db;

/** @deprecated Use DbConnection instead */
export type DbClient = DbConnection;
