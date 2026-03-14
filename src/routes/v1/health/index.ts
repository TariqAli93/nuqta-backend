import { FastifyPluginAsync } from "fastify";

const HealthCheckSchema = {
  type: "object" as const,
  properties: {
    ok: { type: "boolean" },
    status: { type: "string", enum: ["healthy", "unhealthy"] },
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
        uptime: {
          type: "object" as const,
          properties: {
            seconds: { type: "number" },
          },
        },
        memory: {
          type: "object" as const,
          properties: {
            heapUsedBytes: { type: "number" },
            heapTotalBytes: { type: "number" },
            rssBytes: { type: "number" },
            externalBytes: { type: "number" },
          },
        },
      },
    },
  },
};

const health: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["System"],
        summary: "Health check",
        description:
          "Returns application health, database connectivity, uptime, and memory usage.",
        response: {
          200: HealthCheckSchema,
          503: HealthCheckSchema,
        },
      },
    },
    async (_request, reply) => {
      const dbStart = performance.now();
      let databaseStatus: "up" | "down" = "up";

      try {
        const client = (fastify.db as unknown as {
          $client?: { query: (sql: string) => Promise<unknown> };
        }).$client;

        if (!client || typeof client.query !== "function") {
          throw new Error("Database client is unavailable");
        }

        await client.query("SELECT 1");
      } catch {
        databaseStatus = "down";
      }

      const memoryUsage = process.memoryUsage();
      const status = databaseStatus === "up" ? "healthy" : "unhealthy";

      return reply.status(status === "healthy" ? 200 : 503).send({
        ok: status === "healthy",
        status,
        checks: {
          database: {
            status: databaseStatus,
            latencyMs: Math.round(performance.now() - dbStart),
          },
          uptime: {
            seconds: Math.round(process.uptime()),
          },
          memory: {
            heapUsedBytes: memoryUsage.heapUsed,
            heapTotalBytes: memoryUsage.heapTotal,
            rssBytes: memoryUsage.rss,
            externalBytes: memoryUsage.external,
          },
        },
      });
    },
  );
};

export default health;
