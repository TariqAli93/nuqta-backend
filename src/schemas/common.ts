/**
 * Common / shared JSON schemas used across all route modules.
 * Registered once via fastify.addSchema() and referenced via $ref.
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
    data: {},
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

// ─── Pre-built error responses for route schemas ───────────────────
export const ErrorResponses = {
  400: {
    description: "Validation error",
    type: "object" as const,
    required: ["ok", "error"] as const,
    properties: {
      ok: { type: "boolean" as const, const: false },
      error: { $ref: "ErrorDetail#" },
    },
  },
  401: {
    description: "Unauthorized – missing or invalid token",
    type: "object" as const,
    required: ["ok", "error"] as const,
    properties: {
      ok: { type: "boolean" as const, const: false },
      error: { $ref: "ErrorDetail#" },
    },
  },
  403: {
    description: "Forbidden – insufficient permissions",
    type: "object" as const,
    required: ["ok", "error"] as const,
    properties: {
      ok: { type: "boolean" as const, const: false },
      error: { $ref: "ErrorDetail#" },
    },
  },
  404: {
    description: "Resource not found",
    type: "object" as const,
    required: ["ok", "error"] as const,
    properties: {
      ok: { type: "boolean" as const, const: false },
      error: { $ref: "ErrorDetail#" },
    },
  },
  409: {
    description: "Conflict",
    type: "object" as const,
    required: ["ok", "error"] as const,
    properties: {
      ok: { type: "boolean" as const, const: false },
      error: { $ref: "ErrorDetail#" },
    },
  },
  500: {
    description: "Internal server error",
    type: "object" as const,
    required: ["ok", "error"] as const,
    properties: {
      ok: { type: "boolean" as const, const: false },
      error: { $ref: "ErrorDetail#" },
    },
  },
} as const;

/** Helper to build a `{ ok: true, data: <schema> }` response */
export function successEnvelope(
  dataSchema: Record<string, unknown>,
  description = "Successful response",
) {
  return {
    description,
    type: "object" as const,
    required: ["ok", "data"] as const,
    properties: {
      ok: { type: "boolean" as const, const: true },
      data: dataSchema,
    },
  };
}

/** Helper to build a `{ ok: true, data: [<schema>] }` array response */
export function successArrayEnvelope(
  itemSchema: Record<string, unknown>,
  description = "Successful response",
) {
  return successEnvelope(
    { type: "array" as const, items: itemSchema },
    description,
  );
}

/** Helper to build a `{ ok: true, data: null }` response (deletes etc.) */
export const SuccessNullResponse = {
  description: "Operation completed",
  type: "object" as const,
  required: ["ok", "data"] as const,
  properties: {
    ok: { type: "boolean" as const, const: true },
    data: { type: "null" as const },
  },
} as const;

// ─── Security header schema (used by routes needing auth) ──────────
export const BearerHeaderSchema = {
  type: "object" as const,
  properties: {
    authorization: { type: "string", pattern: "^Bearer .+$" },
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
