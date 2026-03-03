import { FastifyPluginAsync } from "fastify";
import {
  LoginUseCase,
  RegisterFirstUserUseCase,
  CheckInitialSetupUseCase,
  ChangePasswordUseCase,
} from "@nuqta/core";
import {
  loginSchema,
  registerSchema,
  setupStatusSchema,
  refreshSchema,
  changePasswordSchema,
  logoutSchema,
  meSchema,
} from "../../../schemas/auth.js";

const auth: FastifyPluginAsync = async (fastify) => {
  // ── helpers ────────────────────────────────────────────────────────

  function buildTokenPayload(
    user: {
      id?: number;
      role: string;
      username: string;
      fullName: string;
      phone?: string | null;
    },
    permissions: string[],
  ) {
    return {
      sub: user.id as unknown as string,
      role: user.role,
      permissions,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone || undefined,
    };
  }

  // ── POST /auth/login ──────────────────────────────────────────────
  fastify.post("/login", { schema: loginSchema }, async (request, reply) => {
    const { username, password } = request.body as {
      username: string;
      password: string;
    };
    const uc = new LoginUseCase(fastify.repos.user);
    const result = await uc.execute({ username, password });

    const payload = buildTokenPayload(result.user, result.permissions);
    const accessToken = fastify.jwt.signAccess(payload);
    const refreshToken = fastify.jwt.signRefresh(payload);

    return {
      ok: true,
      data: {
        accessToken,
        refreshToken,
        // keep legacy `token` key for backwards compat
        token: accessToken,
        user: result.user,
        permissions: result.permissions,
      },
    };
  });

  // ── POST /auth/register (first user only) ─────────────────────────
  fastify.post(
    "/register",
    { schema: registerSchema },
    async (request, reply) => {
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
    },
  );

  // ── GET /auth/setup-status ────────────────────────────────────────
  fastify.get(
    "/setup-status",
    { schema: setupStatusSchema, config: { auth: false } },
    async (request, reply) => {
      const uc = new CheckInitialSetupUseCase(
        fastify.repos.user,
        fastify.repos.settings,
      );
      const status = await uc.execute();
      return { ok: true, data: status };
    },
  );

  // ── POST /auth/logout ─────────────────────────────────────────────
  // Stateless JWT — the client must discard both tokens.
  // A token blacklist (Redis / DB) can be wired here later.
  fastify.post(
    "/logout",
    { schema: logoutSchema, preHandler: fastify.authenticate },
    async (request, reply) => {
      return { ok: true, data: null };
    },
  );

  // ── POST /auth/refresh ────────────────────────────────────────────
  // Accepts a refresh token in the body and issues a new access + refresh pair.
  // Does NOT require the `authenticate` preHandler (the refresh token is self-contained).
  fastify.post(
    "/refresh",
    { schema: refreshSchema },
    async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken?: string };

      if (!refreshToken) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "refreshToken is required",
          },
        });
      }

      const payload = fastify.jwt.verifyRefresh(refreshToken);
      if (!payload) {
        return reply.status(401).send({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired refresh token",
          },
        });
      }

      // Issue a fresh pair (token rotation)
      const tokenData = {
        sub: payload.sub,
        role: payload.role,
        permissions: payload.permissions,
        username: payload.username,
        fullName: payload.fullName,
        phone: payload.phone,
      };

      const newAccessToken = fastify.jwt.signAccess(tokenData);
      const newRefreshToken = fastify.jwt.signRefresh(tokenData);

      return {
        ok: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          // legacy compat
          token: newAccessToken,
        },
      };
    },
  );

  // ── POST /auth/change-password ────────────────────────────────────
  fastify.post(
    "/change-password",
    { schema: changePasswordSchema, preHandler: fastify.authenticate },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };
      const userId = request.user?.sub as number;
      const uc = new ChangePasswordUseCase(fastify.repos.user);
      await uc.execute({ userId, currentPassword, newPassword });
      return { ok: true, data: null };
    },
  );

  // ── GET /auth/me ──────────────────────────────────────────────────
  fastify.get(
    "/me",
    { schema: meSchema, preHandler: fastify.authenticate },
    async (request, reply) => {
      return { ok: true, data: request.user };
    },
  );
};

export default auth;
