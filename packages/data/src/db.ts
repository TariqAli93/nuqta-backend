import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/schema.js";

// Load .env from project root (3 levels up from packages/data/src)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

interface AppEnv {
  DB_HOST: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_PORT?: string;
  DATABASE_URL?: string;
}

const env = process.env as unknown as AppEnv;

/**
 * Create a postgres-js query client and a Drizzle ORM instance.
 * Prefer DATABASE_URL if set, otherwise build from individual vars.
 */
function createQueryClient() {
  if (env.DATABASE_URL) {
    // Strip query params that postgres.js doesn't understand (e.g. ?schema=public)
    const cleanUrl = new URL(env.DATABASE_URL);
    cleanUrl.search = "";
    return postgres(cleanUrl.toString());
  }
  return postgres({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || "5432"),
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
  });
}

export const queryClient = createQueryClient();
export const db = drizzle({ client: queryClient, schema });

export type DbConnection = typeof db;

/** @deprecated Use DbConnection instead */
export type DbClient = DbConnection;
