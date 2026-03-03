/**
 * Auth domain schemas – login, register, setup status.
 */
import {
  ErrorResponses,
  successEnvelope,
  SuccessNullResponse,
} from "./common.js";

// ─── Request Schemas ───────────────────────────────────────────────

export const LoginBodySchema = {
  type: "object" as const,
  required: ["username", "password"],
  properties: {
    username: { type: "string", minLength: 1, description: "Login username" },
    password: { type: "string", minLength: 1, description: "Login password" },
  },
  additionalProperties: false,
} as const;

export const RegisterBodySchema = {
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
    hasUsers: { type: "boolean" },
    isSetupComplete: { type: "boolean" },
  },
};

// ─── Route Schemas ─────────────────────────────────────────────────

export const loginSchema = {
  tags: ["Auth"],
  summary: "User login",
  description: "Authenticate with username and password, returns a JWT token.",
  body: LoginBodySchema,
  response: {
    200: successEnvelope(LoginDataSchema, "Login successful"),
    ...ErrorResponses,
  },
} as const;

export const registerSchema = {
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

export const refreshSchema = {
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

export const changePasswordSchema = {
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

export const logoutSchema = {
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

export const meSchema = {
  tags: ["Auth"],
  summary: "Current user info",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(UserSafeSchema, "Current user"),
    ...ErrorResponses,
  },
} as const;
