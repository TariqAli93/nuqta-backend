/**
 * RBAC Middleware
 * Provides a `requirePermission(...perms)` preHandler factory.
 *
 * Usage in routes:
 *   fastify.get("/", { preHandler: requirePermission("sales:read") }, handler);
 *
 * The middleware expects `request.user` to be populated by the `authenticate`
 * decorator (support.ts). It checks the user's role against the PermissionService.
 */
import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import { PermissionService, type UserRole } from "@nuqta/core";

/**
 * Returns a Fastify preHandler that verifies the authenticated user
 * has **at least one** of the required permissions (OR logic).
 *
 * If the caller needs AND logic, create separate preHandlers or combine
 * permission strings in a wrapper.
 */
export function requirePermission(
  ...permissions: string[]
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user || !user.role) {
      return reply.status(401).send({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }

    const hasAccess = PermissionService.hasAnyPermission(
      user.role as UserRole,
      permissions,
    );

    if (!hasAccess) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions",
          details: { required: permissions, role: user.role },
        },
      });
    }
  };
}
