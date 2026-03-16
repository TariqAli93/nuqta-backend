import { pool } from "./db.js";
import { prepareDatabase } from "./bootstrap.js";

console.log("[DB] Starting migration process");
console.log("[DB] Running migrations");

try {
  await prepareDatabase();
  console.log("[DB] Migrations applied successfully.");
} catch (error: any) {
  console.error("[DB] Migration failed:", error);
  process.exit(1);
} finally {
  await pool.end();
}
