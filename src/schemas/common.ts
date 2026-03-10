/**
 * Common / shared JSON schemas used across all route modules.
 * Registered once via fastify.addSchema() and referenced via $ref.
 *
 * Route-level helpers (ErrorResponses, successEnvelope, etc.) live in
 * src/shared/schema-helpers.ts and are imported directly by each
 * colocated route schema file.
 */

// ─── ID param (e.g. /:id) ──────────────────────────────────────────
export const IdParamsSchema = {
  $id: "IdParams",
  type: "object" as const,
  required: ["id"],
  properties: {
    id: {
      type: "string",
      pattern: "^\\d+$",
      description: "Numeric resource ID",
    },
  },
} as const;

// ─── Pagination query ──────────────────────────────────────────────
export const PaginationQuerySchema = {
  $id: "PaginationQuery",
  type: "object" as const,
  properties: {
    page: {
      type: "string",
      pattern: "^\\d+$",
      description: "Page number (1-based)",
    },
    limit: { type: "string", pattern: "^\\d+$", description: "Items per page" },
  },
} as const;

export const OffsetPaginationQuerySchema = {
  $id: "OffsetPaginationQuery",
  type: "object" as const,
  properties: {
    limit: {
      type: "string",
      pattern: "^\\d+$",
      description: "Max items to return",
    },
    offset: {
      type: "string",
      pattern: "^\\d+$",
      description: "Number of items to skip",
    },
  },
} as const;

// ─── Date range query ──────────────────────────────────────────────
export const DateRangeQuerySchema = {
  $id: "DateRangeQuery",
  type: "object" as const,
  properties: {
    dateFrom: {
      type: "string",
      format: "date",
      description: "Start date (YYYY-MM-DD)",
    },
    dateTo: {
      type: "string",
      format: "date",
      description: "End date (YYYY-MM-DD)",
    },
  },
} as const;

// ─── Standard API envelope ─────────────────────────────────────────
export const SuccessResponseSchema = {
  $id: "SuccessResponse",
  type: "object" as const,
  required: ["ok", "data"],
  properties: {
    ok: { type: "boolean", const: true },
    data: {
      oneOf: [
        { type: "object" as const },
        { type: "array" as const },
        { type: "null" as const },
      ],
    },
  },
} as const;

export const ErrorDetailSchema = {
  $id: "ErrorDetail",
  type: "object" as const,
  required: ["code", "message"],
  properties: {
    code: { type: "string", description: "Machine-readable error code" },
    message: { type: "string", description: "Human-readable description" },
    details: { description: "Additional error context" },
    status: { type: "integer", description: "HTTP status code" },
  },
} as const;

export const ErrorResponseSchema = {
  $id: "ErrorResponse",
  type: "object" as const,
  required: ["ok", "error"],
  properties: {
    ok: { type: "boolean", const: false },
    error: { $ref: "ErrorDetail#" },
  },
} as const;

/** All shared schemas to register with fastify.addSchema() */
export const commonSchemas = [
  IdParamsSchema,
  PaginationQuerySchema,
  OffsetPaginationQuerySchema,
  DateRangeQuerySchema,
  SuccessResponseSchema,
  ErrorDetailSchema,
  ErrorResponseSchema,
];
