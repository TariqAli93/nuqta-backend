/**
 * Audit trail routes
 * Provides read access to the audit log and admin cleanup.
 */
import { FastifyPluginAsync } from "fastify";
import {
  ErrorResponses,
  successEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const AuditEventSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    userId: { type: "integer" },
    action: { type: "string" },
    entityType: { type: "string" },
    entityId: { type: "integer" },
    timestamp: { type: "string", format: "date-time" },
    changedFields: {
      type: "object",
      nullable: true,
      additionalProperties: true,
    },
    changeDescription: { type: "string", nullable: true },
    ipAddress: { type: "string", nullable: true },
    userAgent: { type: "string", nullable: true },
    metadata: { type: "object", nullable: true, additionalProperties: true },
  },
};

const AuditQuerySchema = {
  type: "object" as const,
  properties: {
    entityType: { type: "string" },
    entityId: { type: "string", pattern: "^\\d+$" },
    userId: { type: "string", pattern: "^\\d+$" },
    action: { type: "string" },
    dateFrom: { type: "string", format: "date" },
    dateTo: { type: "string", format: "date" },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const getAuditTrailSchema = {
  tags: ["Audit"],
  summary: "Get audit trail",
  description: "Query the audit log with optional filters.",
  security: [{ bearerAuth: [] }],
  querystring: AuditQuerySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          items: { type: "array" as const, items: AuditEventSchema },
          total: { type: "integer" },
        },
      },
      "Audit trail",
    ),
    ...ErrorResponses,
  },
} as const;

const cleanupAuditSchema = {
  tags: ["Audit"],
  summary: "Cleanup old audit entries",
  description: "Delete audit entries older than a specified number of days.",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object" as const,
    required: ["olderThanDays"],
    properties: {
      olderThanDays: { type: "integer", minimum: 30 },
    },
    additionalProperties: false,
  },
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          deletedCount: { type: "integer" },
        },
      },
      "Cleanup result",
    ),
    ...ErrorResponses,
  },
} as const;

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
