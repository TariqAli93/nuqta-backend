import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../../drizzle");

export async function connectToDatabase(): Promise<void> {
  const client = await pool.connect();
  client.release();
}

export async function runPendingMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
}

export async function prepareDatabase(): Promise<void> {
  await connectToDatabase();
  await runPendingMigrations();
}

