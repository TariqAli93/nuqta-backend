/**
 * Audit domain schemas.
 */
import { ErrorResponses, successEnvelope } from "./common.js";

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

export const getAuditTrailSchema = {
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

export const cleanupAuditSchema = {
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
