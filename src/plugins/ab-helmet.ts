import fp from "fastify-plugin";
import helmet, { FastifyHelmetOptions } from "@fastify/helmet";

/**
 * Sets security-related HTTP response headers (CSP, X-Frame-Options, etc.).
 *
 * Content-Security-Policy is relaxed for the Swagger UI route so that
 * inline scripts / styles used by swagger-ui-dist keep working.
 *
 * @see https://github.com/fastify/fastify-helmet
 */
export default fp<FastifyHelmetOptions>(async (fastify) => {
  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://fastify.dev"],
        fontSrc: ["'self'", "data:"],
      },
    },
  });
});
