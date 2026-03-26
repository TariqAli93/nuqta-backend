import fp from "fastify-plugin";
import cors, { FastifyCorsOptions } from "@fastify/cors";
import { env } from "../shared/env.js";

export default fp<FastifyCorsOptions>(async (fastify) => {
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === "production" ? "*" : "*",
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
