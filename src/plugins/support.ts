import fp from "fastify-plugin";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { AppOptions } from "../app.js";

export interface SupportPluginOptions {
  // Specify Support plugin options here
}

export default fp<SupportPluginOptions & Pick<AppOptions, "testOverrides">>(
  async (fastify, opts) => {
    if (opts.testOverrides?.authenticate) {
      fastify.decorate("authenticate", opts.testOverrides.authenticate as any);
      return;
    }

    fastify.decorate(
      "authenticate",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return reply.status(401).send({
            ok: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing or invalid authorization header",
            },
          });
        }

        const token = authHeader.slice(7);
        // Only accept access tokens for API authorization
        const payload = fastify.jwt.verifyAccess(token);

        if (!payload) {
          return reply.status(401).send({
            ok: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Invalid or expired access token",
            },
          });
        }

        // Attach user info to request
        request.user = {
          sub: payload.sub as unknown as number | undefined,
          role: payload.role,
          permissions: payload.permissions,
          username: payload.username,
          fullName: payload.fullName,
          phone: payload.phone,
        };
      },
    );
  },
);

// Type declarations
declare module "fastify" {
  export interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  export interface FastifyRequest {
    user?: {
      sub: number | undefined; // user ID
      role: string;
      permissions: string[];
      username: string;
      fullName: string;
      phone?: string;
    };
  }
}
