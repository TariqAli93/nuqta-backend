import fp from "fastify-plugin";
import type { RouteOptions } from "fastify";

const DEFAULT_BODY_LIMIT_BYTES = 1 * 1024 * 1024;
const BACKUP_RESTORE_BODY_LIMIT_BYTES = 50 * 1024 * 1024;

function routeUsesMethod(route: RouteOptions, method: string): boolean {
  if (Array.isArray(route.method)) {
    return route.method.includes(method);
  }

  return route.method === method;
}

export default fp(async (fastify) => {
  fastify.addHook("onRoute", (route) => {
    if (route.bodyLimit === undefined) {
      route.bodyLimit = DEFAULT_BODY_LIMIT_BYTES;
    }

    if (routeUsesMethod(route, "POST") && route.url.endsWith("/restore")) {
      route.bodyLimit = BACKUP_RESTORE_BODY_LIMIT_BYTES;
    }
  });
});
