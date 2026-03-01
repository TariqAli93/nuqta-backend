/**
 * Auth domain schemas – login, register, setup status.
 */
import { ErrorResponses, successEnvelope } from "./common.js";

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
    token: { type: "string" },
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
