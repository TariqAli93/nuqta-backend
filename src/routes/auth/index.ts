import { FastifyPluginAsync } from "fastify";
import {
  LoginUseCase,
  RegisterFirstUserUseCase,
  CheckInitialSetupUseCase,
} from "@nuqta/core";

const auth: FastifyPluginAsync = async (fastify) => {
  // POST /auth/login
  fastify.post("/login", async (request, reply) => {
    const { username, password } = request.body as {
      username: string;
      password: string;
    };
    const uc = new LoginUseCase(fastify.repos.user);
    const result = await uc.execute({ username, password });

    // Sign JWT
    const token = fastify.jwt.sign({
      sub: result.user.id!,
      role: result.user.role,
      permissions: result.permissions,
    });

    return {
      ok: true,
      data: { token, user: result.user, permissions: result.permissions },
    };
  });

  // POST /auth/register (first user only)
  fastify.post("/register", async (request, reply) => {
    const body = request.body as {
      username: string;
      password: string;
      fullName: string;
      phone?: string;
    };
    const uc = new RegisterFirstUserUseCase(fastify.repos.user);
    const user = await uc.execute({
      username: body.username,
      password: body.password,
      fullName: body.fullName,
      phone: body.phone,
      role: "admin",
    });
    return { ok: true, data: user };
  });

  // GET /auth/setup-status
  fastify.get("/setup-status", async (request, reply) => {
    const uc = new CheckInitialSetupUseCase(
      fastify.repos.user,
      fastify.repos.settings,
    );
    const status = await uc.execute();
    return { ok: true, data: status };
  });
};

export default auth;
