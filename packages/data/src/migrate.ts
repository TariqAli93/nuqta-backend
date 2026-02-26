import path from "path";
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, queryClient } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrationsFolder = path.resolve(__dirname, "../drizzle");

console.log("[DB] Starting migration process");
console.log("[DB] Running migrations");
console.log("[DB] Migrations folder:", migrationsFolder);

try {
  await migrate(db, { migrationsFolder });
  console.log("[DB] Migrations applied successfully.");
} catch (error: any) {
  console.error("[DB] Migration failed:", error);
  process.exit(1);
} finally {
  await queryClient.end();
}
