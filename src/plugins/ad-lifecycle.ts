/**
 * Lifecycle plugin — graceful shutdown handling.
 * File name prefixed "ad-" so autoload runs it after ac-* plugins.
 */
import fp from "fastify-plugin";
import type { ServerResponse } from "node:http";

const SHUTDOWN_TIMEOUT_MS =
  Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000;
const SSE_SHUTDOWN_EVENT = "server.shutdown";

// Purge expired revoked tokens every 6 hours
const REVOCATION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

export default fp(async (fastify) => {
  let isShuttingDown = false;
  const trackedSseConnections = new Set<ServerResponse>();

  // Start the revocation cleanup job after server is ready
  fastify.addHook("onReady", async () => {
    const cleanup = async () => {
      try {
        const deleted = await fastify.repos.revokedToken.deleteExpired();
        if (deleted > 0) {
          fastify.log.info({ deleted }, "Pruned expired revoked tokens");
        }
      } catch (err) {
        fastify.log.warn(err, "Failed to prune expired revoked tokens");
      }
    };

    const timer = setInterval(() => {
      void cleanup();
    }, REVOCATION_CLEANUP_INTERVAL_MS);

    // Allow Node.js to exit even if this timer is pending
    timer.unref();

    fastify.addHook("onClose", async () => {
      clearInterval(timer);
    });
  });

  const handleSigint = () => {
    void gracefulShutdown("SIGINT");
  };

  const handleSigterm = () => {
    void gracefulShutdown("SIGTERM");
  };

  fastify.decorate("trackSseConnection", (response: ServerResponse) => {
    trackedSseConnections.add(response);
    response.once("close", () => {
      trackedSseConnections.delete(response);
    });
  });

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
  process.on("SIGINT", handleSigint);
  process.on("SIGTERM", handleSigterm);

  // Register onClose hook to clean up database connections
  fastify.addHook("onClose", async () => {
    if (trackedSseConnections.size > 0) {
      fastify.log.info(
        { connections: trackedSseConnections.size },
        "Closing SSE connections",
      );
    }

    for (const response of Array.from(trackedSseConnections)) {
      trackedSseConnections.delete(response);

      if (response.destroyed || response.writableEnded) {
        continue;
      }

      try {
        response.write(
          `event: ${SSE_SHUTDOWN_EVENT}\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`,
        );
        response.end();
      } catch (err) {
        fastify.log.warn(err, "Error closing SSE connection");
      }
    }

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

    process.off("SIGINT", handleSigint);
    process.off("SIGTERM", handleSigterm);
  });
});

declare module "fastify" {
  interface FastifyInstance {
    trackSseConnection(response: ServerResponse): void;
  }
}
