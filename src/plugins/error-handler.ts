import fp from "fastify-plugin";
import { isDomainError, toApiError } from "@nuqta/core";

export default fp(async (fastify) => {
  // ── Custom validation error formatter ─────────────────────────────
  // Transforms AJV validation errors into the standard { ok, error } envelope
  // so that runtime validation and documented 400 schemas stay in sync.
  fastify.setErrorHandler(
    async (
      error: Error & {
        validation?: Array<{
          instancePath?: string;
          params?: Record<string, string>;
          message?: string;
          keyword?: string;
        }>;
        statusCode?: number;
      },
      request,
      reply,
    ) => {
      // Fastify sets statusCode 400 and a `validation` array for AJV failures
      if (error.validation) {
        const details = error.validation.map((v) => ({
          field: v.instancePath || v.params?.missingProperty || "unknown",
          message: v.message || "Invalid value",
          keyword: v.keyword,
        }));

        return reply.status(400).send({
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details,
          },
        });
      }

      const apiError = toApiError(error);

      // Use status from DomainError if available, otherwise default to 500
      const statusCode = isDomainError(error)
        ? error.statusCode
        : error.statusCode || 500;

      if (statusCode >= 500) {
        fastify.log.error(error);
      } else {
        fastify.log.warn({ err: apiError }, `${statusCode} ${apiError.code}`);
      }

      return reply.status(statusCode).send({ ok: false, error: apiError });
    },
  );
});
