/**
 * Audit trail routes
 * Provides read access to the audit log and admin cleanup.
 */
import { FastifyPluginAsync } from "fastify";
import {
  getAuditTrailSchema,
  cleanupAuditSchema,
} from "../../../schemas/audit.js";
import { requirePermission } from "../../../middleware/rbac.js";

const audit: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /audit/trail
  fastify.get(
    "/trail",
    {
      schema: getAuditTrailSchema,
      preHandler: requirePermission("audit:read"),
    },
    async (request) => {
      const query = request.query as {
        entityType?: string;
        entityId?: string;
        userId?: string;
        action?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: string;
        offset?: string;
      };

      const filters: Record<string, unknown> = {};
      if (query.entityType) filters.entityType = query.entityType;
      if (query.entityId) filters.entityId = parseInt(query.entityId, 10);
      if (query.userId) filters.userId = parseInt(query.userId, 10);
      if (query.action) filters.action = query.action;
      if (query.dateFrom) filters.dateFrom = query.dateFrom;
      if (query.dateTo) filters.dateTo = query.dateTo;

      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const [items, total] = await Promise.all([
        fastify.repos.audit.getByFilters({ ...filters, limit, offset }),
        fastify.repos.audit.count(filters),
      ]);

      return { ok: true, data: { items, total } };
    },
  );

  // POST /audit/cleanup
  fastify.post(
    "/cleanup",
    {
      schema: cleanupAuditSchema,
      preHandler: requirePermission("audit:cleanup"),
    },
    async (request) => {
      const { olderThanDays } = request.body as { olderThanDays: number };
      const deletedCount =
        await fastify.repos.audit.deleteOlderThan(olderThanDays);
      return { ok: true, data: { deletedCount } };
    },
  );
};

export default audit;
