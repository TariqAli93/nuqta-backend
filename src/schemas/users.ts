/**
 * User domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
} from "./common.js";

const UserSchema = {
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

const CreateUserBodySchema = {
  type: "object" as const,
  required: ["username", "password", "fullName"],
  properties: {
    username: { type: "string", minLength: 1 },
    password: { type: "string", minLength: 1 },
    fullName: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    role: {
      type: "string",
      enum: ["admin", "cashier", "manager", "viewer"],
      default: "cashier",
    },
    isActive: { type: "boolean", default: true },
  },
  additionalProperties: false,
} as const;

const UpdateUserBodySchema = {
  type: "object" as const,
  properties: {
    username: { type: "string", minLength: 1 },
    password: { type: "string", minLength: 1 },
    fullName: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    role: { type: "string", enum: ["admin", "cashier", "manager", "viewer"] },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

export const getUsersSchema = {
  tags: ["Users"],
  summary: "List all users",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(UserSchema, "List of users"),
    ...ErrorResponses,
  },
} as const;

export const getUserByIdSchema = {
  tags: ["Users"],
  summary: "Get user by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(UserSchema, "User details"),
    ...ErrorResponses,
  },
} as const;

export const createUserSchema = {
  tags: ["Users"],
  summary: "Create a user",
  security: [{ bearerAuth: [] }],
  body: CreateUserBodySchema,
  response: {
    200: successEnvelope(UserSchema, "Created user"),
    ...ErrorResponses,
  },
} as const;

export const updateUserSchema = {
  tags: ["Users"],
  summary: "Update a user",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateUserBodySchema,
  response: {
    200: successEnvelope(UserSchema, "Updated user"),
    ...ErrorResponses,
  },
} as const;
