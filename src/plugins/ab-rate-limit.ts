import fp from "fastify-plugin";
import rateLimit, { RateLimitPluginOptions } from "@fastify/rate-limit";

/**
 * Global rate-limiter.
 *
 * Defaults: 100 requests per minute per IP.
 * Override via RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_MS env vars.
 *
 * @see https://github.com/fastify/fastify-rate-limit
 */
export default fp<RateLimitPluginOptions>(async (fastify) => {
  await fastify.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    allowList: ["127.0.0.1", "::1"], // no limit for localhost
    addHeadersOnExceeding: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
    errorResponseBuilder: (_request, context) => ({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: `Too many requests – limit is ${context.max} per ${context.after}. Please try again later.`,
      },
    }),
  });
});
