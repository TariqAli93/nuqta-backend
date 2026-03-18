import fp from "fastify-plugin";
import cors, { FastifyCorsOptions } from "@fastify/cors";

/**
 * Enables Cross-Origin Resource Sharing (CORS).
 *
 * Allowed origins, methods and headers can be controlled via environment
 * variables. Defaults are permissive for local development.
 *
 * @see https://github.com/fastify/fastify-cors
 */
export default fp<FastifyCorsOptions>(async (fastify) => {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : [];

  // In production, refuse to start without explicit CORS configuration
  if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
    throw new Error(
      "CORS_ORIGIN environment variable must be set in production",
    );
  }

  // In development, fall back to allowing all origins
  const originConfig =
    allowedOrigins.length === 0
      ? true
      : allowedOrigins.includes("*")
        ? true
        : allowedOrigins;

  await fastify.register(cors, {
    origin: originConfig,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Last-Event-ID",
    ],
    credentials: true,
    maxAge: 86_400, // 24 h preflight cache
  });
});
