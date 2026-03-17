/**
 * Standalone CLI entry-point for `pnpm db:migrate`.
 *
 * Creates the target database when it doesn't exist and applies all
 * pending Drizzle migrations, then exits.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load .env before importing db.ts so DATABASE_URL / DB_NAME are available.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { prepareDatabase, pool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const entryArg = process.argv[1];

if (entryArg && path.resolve(entryArg) === path.resolve(__filename)) {
  prepareDatabase()
    .then(async () => {
      console.log("Database preparation and migrations complete.");
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Migration failed:", error);
      await pool.end();
      process.exit(1);
    });
}
