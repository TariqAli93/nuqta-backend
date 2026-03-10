/**
 * Shared JSON-Schema helpers used by every domain's route schemas.
 *
 * These are pure functions / constants — they do NOT contain any
 * fastify.addSchema() `$ref` definitions.  The `$ref` schemas
 * (IdParams, PaginationQuery, etc.) live in the Swagger plugin
 * (plugins/aa-swagger.ts) and are registered at boot time.
 */

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
  return {
    description,
    type: "object" as const,
    required: ["ok", "data"] as const,
    properties: {
      ok: { type: "boolean" as const, const: true },
      data: {
        type: "array" as const,
        items: itemSchema,
      },
    },
  };
}

/** Helper to build a `{ ok: true, data: { items: [...], total } }` paginated response */
export function successPaginatedEnvelope(
  itemSchema: Record<string, unknown>,
  description = "Successful response",
  extraProps?: Record<string, Record<string, unknown>>,
) {
  const properties: Record<string, unknown> = {
    items: { type: "array" as const, items: itemSchema },
    total: { type: "integer" as const },
    ...extraProps,
  };
  return successEnvelope({ type: "object" as const, properties }, description);
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

// ─── Route response helpers ────────────────────────────────────────
// Thin wrappers so every handler returns the exact envelope shape.

/** Wrap a value in `{ ok: true, data }` */
export function okReply<T>(data: T) {
  return { ok: true as const, data };
}

/** Wrap a paginated result in `{ ok: true, data: { items, total } }` */
export function okPage<T>(items: T[], total: number) {
  return { ok: true as const, data: { items, total } };
}

// ─── Security header schema (used by routes needing auth) ──────────
export const BearerHeaderSchema = {
  type: "object" as const,
  properties: {
    authorization: { type: "string", pattern: "^Bearer .+$" },
  },
} as const;
