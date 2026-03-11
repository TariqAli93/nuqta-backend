/**
 * Response compression plugin (gzip + brotli).
 * Prefixed "ab-" for early registration in autoload order.
 */
import fp from "fastify-plugin";
import compress from "@fastify/compress";

export default fp(async (fastify) => {
  await fastify.register(compress, {
    // Minimum response size to compress (1KB)
    threshold: 1024,
    // Prefer brotli when supported, fall back to gzip
    encodings: ["br", "gzip", "deflate"],
    // Don't compress SSE streams
    removeContentLengthHeader: true,
  });
});
