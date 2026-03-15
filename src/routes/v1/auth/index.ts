import { FastifyPluginAsync } from "fastify";
import {
  LoginUseCase,
  LogoutUseCase,
  RegisterFirstUserUseCase,
  CheckInitialSetupUseCase,
  ChangePasswordUseCase,
  GetUserByIdUseCase,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";

// ─── Request Schemas ───────────────────────────────────────────────

const LoginBodySchema = {
  type: "object" as const,
  required: ["username", "password"],
  properties: {
    username: { type: "string", minLength: 1, description: "Login username" },
    password: { type: "string", minLength: 1, description: "Login password" },
  },
  additionalProperties: false,
} as const;

const RegisterBodySchema = {
  type: "object" as const,
  required: ["username", "password", "fullName"],
  properties: {
    username: { type: "string", minLength: 1 },
    password: { type: "string", minLength: 1 },
    fullName: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
  },
  additionalProperties: false,
} as const;

// ─── Response Schemas ──────────────────────────────────────────────

const UserSafeSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    username: { type: "string" },
    fullName: { type: "string" },
    phone: { type: "string", nullable: true },
    role: { type: "string", enum: ["admin", "cashier", "manager", "viewer"] },
    isActive: { type: "boolean" },
    lastLoginAt: { type: "string", nullable: true, format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
  },
};

const LoginDataSchema = {
  type: "object" as const,
  properties: {
    accessToken: { type: "string" },
    refreshToken: { type: "string" },
    token: { type: "string", description: "Legacy alias for accessToken" },
    user: UserSafeSchema,
    permissions: { type: "array", items: { type: "string" } },
  },
};

const SetupStatusDataSchema = {
  type: "object" as const,
  properties: {
    isInitialized: { type: "boolean" },
    hasUsers: { type: "boolean" },
    hasCompanyInfo: { type: "boolean" },
    wizardCompleted: { type: "boolean" },
  },
};

// ─── Route Schemas ─────────────────────────────────────────────────

const loginSchema = {
  tags: ["Auth"],
  summary: "User login",
  description: "Authenticate with username and password, returns a JWT token.",
  body: LoginBodySchema,
  response: {
    200: successEnvelope(LoginDataSchema, "Login successful"),
    ...ErrorResponses,
  },
} as const;

const registerSchema = {
  tags: ["Auth"],
  summary: "Register first user",
  description:
    "Register the initial admin user. Only works when no users exist.",
  body: RegisterBodySchema,
  response: {
    200: successEnvelope(UserSafeSchema, "User created"),
    ...ErrorResponses,
  },
} as const;

export const setupStatusSchema = {
  tags: ["Auth"],
  summary: "Check setup status",
  description: "Check whether initial setup has been completed.",
  response: {
    200: successEnvelope(SetupStatusDataSchema, "Setup status"),
    ...ErrorResponses,
  },
} as const;

// ─── Refresh ───────────────────────────────────────────────────────

const RefreshBodySchema = {
  type: "object" as const,
  required: ["refreshToken"],
  properties: {
    refreshToken: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;

const RefreshDataSchema = {
  type: "object" as const,
  properties: {
    accessToken: { type: "string" },
    refreshToken: { type: "string" },
    token: { type: "string" },
  },
};

const refreshSchema = {
  tags: ["Auth"],
  summary: "Refresh tokens",
  description:
    "Exchange a valid refresh token for a new access + refresh pair (token rotation).",
  body: RefreshBodySchema,
  response: {
    200: successEnvelope(RefreshDataSchema, "New token pair"),
    ...ErrorResponses,
  },
} as const;

// ─── Change password ───────────────────────────────────────────────

const ChangePasswordBodySchema = {
  type: "object" as const,
  required: ["currentPassword", "newPassword"],
  properties: {
    currentPassword: { type: "string", minLength: 1 },
    newPassword: { type: "string", minLength: 6 },
  },
  additionalProperties: false,
} as const;

const changePasswordSchema = {
  tags: ["Auth"],
  summary: "Change password",
  description: "Change the currently authenticated user's password.",
  security: [{ bearerAuth: [] }],
  body: ChangePasswordBodySchema,
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

// ─── Logout ────────────────────────────────────────────────────────

const logoutSchema = {
  tags: ["Auth"],
  summary: "Logout",
  description:
    "Client should discard tokens. Server-side blacklist is optional.",
  security: [{ bearerAuth: [] }],
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

// ─── Me ────────────────────────────────────────────────────────────

const meSchema = {
  tags: ["Auth"],
  summary: "Current user info",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(UserSafeSchema, "Current user"),
    ...ErrorResponses,
  },
} as const;

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
  fastify.post("/login", { schema: loginSchema, config: { rateLimit: { max: 10, timeWindow: 60_000 } } }, async (request, reply) => {
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
        token: accessToken,
        user: result.user,
        permissions: result.permissions,
      },
    };
  });

  // ── POST /auth/register (first user only) ─────────────────────────
  fastify.post(
    "/register",
    { schema: registerSchema, config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
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
  fastify.post(
    "/logout",
    { schema: logoutSchema, preHandler: fastify.authenticate },
    async (request, reply) => {
      const authHeader = request.headers.authorization!;
      const token = authHeader.slice(7);
      const accessPayload = fastify.jwt.verifyAccess(token);

      if (accessPayload?.jti) {
        const uc = new LogoutUseCase(fastify.repos.revokedToken);
        const userId = String(request.user?.sub ?? "system");
        // exp comes from the decoded JWT; cast is safe when jti is present
        const tokenWithClaims = accessPayload as typeof accessPayload & {
          jti: string;
          exp: number;
        };
        await uc.execute({ accessToken: tokenWithClaims }, userId);
      }

      return { ok: true, data: null };
    },
  );

  // ── POST /auth/refresh ────────────────────────────────────────────
  // Accepts a refresh token in the body and issues a new access + refresh pair.
  // Does NOT require the `authenticate` preHandler (the refresh token is self-contained).
  fastify.post(
    "/refresh",
    { schema: refreshSchema, config: { rateLimit: { max: 20, timeWindow: 60_000 } } },
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
      const userId = request.user?.sub as number;
      const uc = new GetUserByIdUseCase(fastify.repos.user);
      const user = await uc.execute(userId);
      if (!user) {
        return reply.status(401).send({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "User not found" },
        });
      }
      const { password, ...safeUser } = user;
      return { ok: true, data: safeUser };
    },
  );
};

export default auth;
