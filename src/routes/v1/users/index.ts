import { FastifyPluginAsync } from "fastify";
import {
  CreateUserUseCase,
  UpdateUserUseCase,
  NotFoundError,
  type User,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

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

const getUsersSchema = {
  tags: ["Users"],
  summary: "List all users",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(UserSchema, "List of users"),
    ...ErrorResponses,
  },
} as const;

const getUserByIdSchema = {
  tags: ["Users"],
  summary: "Get user by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(UserSchema, "User details"),
    ...ErrorResponses,
  },
} as const;

const createUserSchema = {
  tags: ["Users"],
  summary: "Create a user",
  security: [{ bearerAuth: [] }],
  body: CreateUserBodySchema,
  response: {
    200: successEnvelope(UserSchema, "Created user"),
    ...ErrorResponses,
  },
} as const;

const updateUserSchema = {
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

const users: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /users
  fastify.get(
    "/",
    { schema: getUsersSchema, preHandler: requirePermission("users:read") },
    async (request) => {
      const data = await fastify.repos.user.findAll();
      return { ok: true, data };
    },
  );

  fastify.get(
    "/:id",
    { schema: getUserByIdSchema, preHandler: requirePermission("users:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = await fastify.repos.user.findById(Number(id));
      if (!data) {
        throw new NotFoundError("المستخدم غير موجود");
      }
      return { ok: true, data };
    },
  );

  // POST /users
  fastify.post(
    "/",
    { schema: createUserSchema, preHandler: requirePermission("users:create") },
    async (request) => {
      const body = request.body as User;
      const uc = new CreateUserUseCase(fastify.repos.user);
      const data = await uc.execute(
        body,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // PUT /users/:id
  fastify.put<{ Params: { id: string } }>(
    "/:id",
    { schema: updateUserSchema, preHandler: requirePermission("users:update") },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as Partial<User>;
      const uc = new UpdateUserUseCase(fastify.repos.user);
      const data = await uc.execute(
        { id, user: body },
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );
};

export default users;
