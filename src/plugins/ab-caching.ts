import fp from "fastify-plugin";
import caching, { FastifyCachingPluginOptions } from "@fastify/caching";

/**
 * Adds ETag generation and Cache-Control headers to responses.
 *
 * Privacy is set to "private" so CDN / shared caches won't store
 * authenticated API responses. expiresIn controls `max-age`.
 *
 * @see https://github.com/fastify/fastify-caching
 */
export default fp<FastifyCachingPluginOptions>(async (fastify) => {
  await fastify.register(caching, {
    privacy: "private",
    expiresIn: 300, // 5 minutes, in seconds
  });
});
