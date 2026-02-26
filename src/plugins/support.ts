import fp from "fastify-plugin";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "@nuqta/core";

export interface SupportPluginOptions {
  // Specify Support plugin options here
}

export default fp<SupportPluginOptions>(async (fastify) => {
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
      const payload = fastify.jwt.verify(token);

      if (!payload) {
        return reply.status(401).send({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
        });
      }

      // Attach user info to request
      request.user = payload;
    },
  );
});

// Type declarations
declare module "fastify" {
  export interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  export interface FastifyRequest {
    user?: JwtPayload;
  }
}
