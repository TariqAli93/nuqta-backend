/**
 * Request Context plugin
 * Adds a unique requestId to every request and logs request duration.
 * File name prefixed "ac-" so autoload runs it after ab-* plugins, before db.ts.
 */
import fp from "fastify-plugin";
import { randomUUID } from "crypto";

export default fp(async (fastify) => {
  // Attach a unique request ID
  fastify.addHook("onRequest", async (request) => {
    request.requestId =
      (request.headers["x-request-id"] as string) ?? randomUUID();
  });

  // Log duration on response
  fastify.addHook("onResponse", async (request, reply) => {
    const duration = reply.elapsedTime; // Fastify built-in (ms)
    fastify.log.info(
      {
        requestId: request.requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(duration),
      },
      "request completed",
    );
  });
});

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}
