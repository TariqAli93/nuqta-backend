import fp from "fastify-plugin";
import { isDomainError, toApiError } from "@nuqta/core";

export default fp(async (fastify) => {
  fastify.setErrorHandler(async (error, request, reply) => {
    const apiError = toApiError(error);

    // Use status from DomainError if available, otherwise default to 500
    const statusCode = isDomainError(error) ? error.statusCode : 500;

    if (statusCode >= 500) {
      fastify.log.error(error);
    } else {
      fastify.log.warn({ err: apiError }, `${statusCode} ${apiError.code}`);
    }

    return reply.status(statusCode).send({ ok: false, error: apiError });
  });
});
