import fp from "fastify-plugin";

/**
 * Bootstrap plugin — runs before all other plugins (alphabetical `a0-` prefix).
 *
 * Creates the target PostgreSQL database when it doesn't exist and applies
 * any pending Drizzle migrations so the application is ready to serve
 * requests by the time the remaining plugins load.
 */
export default fp(async (fastify) => {
  const { prepareDatabase } = await import("../data/db/db.js");

  fastify.log.info("Preparing database (create if missing + migrate)…");
  await prepareDatabase();
  fastify.log.info("Database ready.");
});
