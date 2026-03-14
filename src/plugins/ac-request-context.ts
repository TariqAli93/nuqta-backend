/**
 * Request Context plugin
 * Adds a unique requestId to every request and logs request duration
 * with structured context including userId, IP, and content-length.
 * File name prefixed "ac-" so autoload runs it after ab-* plugins, before db.ts.
 */
import fp from "fastify-plugin";
import { randomUUID } from "crypto";

export default fp(async (fastify) => {
  // Attach a unique request ID and set child logger with correlation
  fastify.addHook("onRequest", async (request) => {
    const headerRequestId = request.headers["x-request-id"];
    request.requestId = Array.isArray(headerRequestId)
      ? (headerRequestId[0] ?? randomUUID())
      : (headerRequestId ?? randomUUID());

    // Enrich Pino child logger with request context for all downstream logs
    request.log = request.log.child({
      requestId: request.requestId,
      method: request.method,
      url: request.url,
    });
  });

  fastify.addHook("preHandler", async (request) => {
    if (request.user?.sub !== undefined) {
      request.log = request.log.child({
        userId: request.user.sub,
      });
    }
  });

  // Log duration on response with structured fields
  fastify.addHook("onResponse", async (request, reply) => {
    const duration = reply.elapsedTime; // Fastify built-in (ms)
    const logData: Record<string, unknown> = {
      statusCode: reply.statusCode,
      durationMs: Math.round(duration),
      userId: request.user?.sub ?? null,
      ip: request.ip,
    };

    // Include content-length for POST/PUT/PATCH
    const contentLength = request.headers["content-length"];
    if (contentLength) {
      logData.contentLength = Number(
        Array.isArray(contentLength) ? contentLength[0] : contentLength,
      );
    }

    if (reply.statusCode >= 400) {
      request.log.warn(logData, "request completed with error");
    } else {
      request.log.info(logData, "request completed");
    }
  });
});

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}
