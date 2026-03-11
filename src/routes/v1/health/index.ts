import { FastifyPluginAsync } from "fastify";

const HealthCheckSchema = {
  type: "object" as const,
  properties: {
    ok: { type: "boolean" },
    status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
    uptime: { type: "number" },
    timestamp: { type: "string", format: "date-time" },
    checks: {
      type: "object" as const,
      properties: {
        database: {
          type: "object" as const,
          properties: {
            status: { type: "string", enum: ["up", "down"] },
            latencyMs: { type: "number" },
          },
        },
        memory: {
          type: "object" as const,
          properties: {
            heapUsedMB: { type: "number" },
            heapTotalMB: { type: "number" },
            rssMB: { type: "number" },
          },
        },
      },
    },
  },
};

const health: FastifyPluginAsync = async (fastify) => {
  // GET /health — unauthenticated health check
  fastify.get(
    "/",
    {
      schema: {
        tags: ["System"],
        summary: "Health check",
        description:
          "Returns system health status including database connectivity and memory usage.",
        response: {
          200: HealthCheckSchema,
          503: HealthCheckSchema,
        },
      },
    },
    async (_request, reply) => {
      const checks: Record<string, unknown> = {};
      let status: "healthy" | "degraded" | "unhealthy" = "healthy";

      // Database check
      const dbStart = performance.now();
      try {
        // Access pg Pool via Drizzle's $client to run raw health check
        const pool = (fastify.db as unknown as { $client: { query: (sql: string) => Promise<unknown> } }).$client;
        await pool.query("SELECT 1");
        checks.database = {
          status: "up",
          latencyMs: Math.round(performance.now() - dbStart),
        };
      } catch {
        checks.database = {
          status: "down",
          latencyMs: Math.round(performance.now() - dbStart),
        };
        status = "unhealthy";
      }

      // Memory check
      const mem = process.memoryUsage();
      checks.memory = {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      };

      const responseCode = status === "unhealthy" ? 503 : 200;

      return reply.status(responseCode).send({
        ok: status === "healthy",
        status,
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        checks,
      });
    },
  );
};

export default health;
