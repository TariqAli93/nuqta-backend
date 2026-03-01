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
    : ["*"];

  await fastify.register(cors, {
    origin: allowedOrigins.includes("*") ? true : allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86_400, // 24 h preflight cache
  });
});
