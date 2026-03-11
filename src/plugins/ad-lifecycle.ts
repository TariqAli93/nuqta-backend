/**
 * Lifecycle plugin — graceful shutdown handling.
 * File name prefixed "ad-" so autoload runs it after ac-* plugins.
 */
import fp from "fastify-plugin";

const SHUTDOWN_TIMEOUT_MS =
  Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000;

export default fp(async (fastify) => {
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    fastify.log.info({ signal }, "Received shutdown signal, closing gracefully");

    // Set a hard deadline for shutdown
    const forceExit = setTimeout(() => {
      fastify.log.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    // Prevent the timer from keeping the process alive
    forceExit.unref();

    try {
      await fastify.close();
      fastify.log.info("Server closed gracefully");
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, "Error during graceful shutdown");
      process.exit(1);
    }
  }

  // Register signal handlers
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Register onClose hook to clean up database connections
  fastify.addHook("onClose", async () => {
    fastify.log.info("Draining database connection pool");
    try {
      // Drizzle's underlying pg pool
      const pool = (fastify.db as unknown as { $client?: { end: () => Promise<void> } })
        ?.$client;
      if (pool && typeof pool.end === "function") {
        await pool.end();
      }
    } catch (err) {
      fastify.log.warn(err, "Error closing database pool");
    }
  });
});
