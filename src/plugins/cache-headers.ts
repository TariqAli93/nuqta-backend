import { createHash } from "node:crypto";
import fp from "fastify-plugin";

/**
 * Adds ETag headers to GET responses on cacheable routes.
 * Clients can send If-None-Match to avoid re-downloading unchanged data.
 */

const CACHEABLE_PREFIXES = [
  "/api/v1/settings",
  "/api/v1/categories",
  "/api/v1/products",
  "/api/v1/dashboard",
  "/api/v1/system",
];

function isCacheable(url: string, method: string): boolean {
  if (method !== "GET") return false;
  return CACHEABLE_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export default fp(async (fastify) => {
  fastify.addHook("onSend", async (request, reply, payload) => {
    if (!isCacheable(request.url, request.method)) return payload;

    // Only add ETag to JSON responses
    const contentType = reply.getHeader("content-type");
    if (
      typeof contentType === "string" &&
      !contentType.includes("application/json")
    ) {
      return payload;
    }

    if (typeof payload === "string" || Buffer.isBuffer(payload)) {
      const body = typeof payload === "string" ? payload : payload.toString();
      const etag = `"${createHash("md5").update(body).digest("hex")}"`;

      void reply.header("ETag", etag);
      void reply.header("Cache-Control", "private, no-cache");

      // Check If-None-Match
      const ifNoneMatch = request.headers["if-none-match"];
      if (ifNoneMatch === etag) {
        void reply.code(304);
        return "";
      }
    }

    return payload;
  });
});
