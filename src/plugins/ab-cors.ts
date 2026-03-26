import fp from "fastify-plugin";
import cors, { FastifyCorsOptions } from "@fastify/cors";
import { env } from "../shared/env.js";

export default fp<FastifyCorsOptions>(async (fastify) => {
  const allowedOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  if (env.NODE_ENV === "production" && allowedOrigins.length === 0) {
    throw new Error(
      "CORS_ORIGIN environment variable must be set in production",
    );
  }

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
    maxAge: 86_400,
  });
});
