import { FastifyPluginAsync } from "fastify";
import type { DomainEvent } from "../../../plugins/event-bus.js";

const HEARTBEAT_INTERVAL_MS = 30_000;

const events: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /events/stream — Server-Sent Events endpoint
  fastify.get(
    "/stream",
    {
      schema: {
        tags: ["Events"],
        summary: "SSE event stream",
        description:
          "Server-Sent Events stream for real-time domain event notifications. " +
          "Requires authentication. Sends heartbeat every 30s.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      // Set SSE headers
      void reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable Nginx buffering
      });

      // Send initial connection event
      reply.raw.write(
        `event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`,
      );

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (!reply.raw.destroyed) {
          reply.raw.write(`:heartbeat ${new Date().toISOString()}\n\n`);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Subscribe to domain events
      const handler = (event: DomainEvent) => {
        if (!reply.raw.destroyed) {
          reply.raw.write(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          );
        }
      };

      const unsubscribe = fastify.eventBus.subscribe(handler);

      // Cleanup on disconnect
      request.raw.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });

      // Prevent Fastify from ending the response
      await reply;
    },
  );
};

export default events;
