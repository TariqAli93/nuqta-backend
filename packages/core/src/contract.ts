/**
 * Unified API Contract
 *
 * Single source of truth for request/response shapes used across:
 * - IPC (Electron main ↔ renderer via preload)
 * - Cloud API (Fastify routes ↔ CloudClient)
 *
 * RULES:
 * 1. Every handler returns ApiResult<T>.
 * 2. No nested wrapper keys (no { sale: ... } inside data).
 * 3. UI never sends userId in offline mode (resolved by UserContextService).
 * 4. Payload validation happens at the boundary only.
 */

import { isDomainError, type DomainError } from './errors/DomainErrors.js';

// ─── Response types ────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

// ─── Helpers ───────────────────────────────────────────────────────────

/** Wrap a successful value in the standard envelope */
export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

/** Wrap an error in the standard envelope */
export function fail(error: ApiError): ApiResult<never> {
  return { ok: false, error };
}

/** Convenience: fail from just a code + message */
export function failWith(
  code: string,
  message: string,
  status?: number,
  details?: unknown
): ApiResult<never> {
  return { ok: false, error: { code, message, status, details } };
}

// ─── Error mapping ─────────────────────────────────────────────────────

/**
 * Convert any caught error (DomainError, Error, string, unknown) into ApiError.
 * Used at IPC boundary and Fastify error handlers.
 */
export function toApiError(error: unknown): ApiError {
  if (isDomainError(error)) {
    return {
      code: error.code,
      message: error.message,
      status: error.statusCode,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
    };
  }

  if (typeof error === 'string') {
    return { code: 'INTERNAL_ERROR', message: error };
  }

  return { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
}

/**
 * Catch-all: convert any thrown error into an ApiResult failure.
 * This is the SINGLE mapper used by all IPC handlers and cloud routes.
 */
export function mapErrorToResult(error: unknown): ApiResult<never> {
  return fail(toApiError(error));
}

// ─── Response type guards ──────────────────────────────────────────────

export function isOk<T>(result: ApiResult<T>): result is { ok: true; data: T } {
  return result.ok === true;
}

export function isErr<T>(result: ApiResult<T>): result is { ok: false; error: ApiError } {
  return result.ok === false;
}
