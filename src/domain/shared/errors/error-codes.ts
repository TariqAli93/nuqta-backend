/**
 * Standardized error codes shared between backend and frontend.
 * Every DomainError code must exist here.
 */
export const ErrorCodes = {
  // ── Client errors ──
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  CONFLICT: "CONFLICT",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  INVALID_STATE: "INVALID_STATE",
  RATE_LIMITED: "RATE_LIMITED",

  // ── Network/transport errors ──
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  CANCELLED: "CANCELLED",

  // ── Server errors ──
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",

  // ── Generic ──
  UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
