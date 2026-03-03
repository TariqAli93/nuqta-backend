import { FastifyPluginAsync } from "fastify";
import {
  GetUsersUseCase,
  CreateUserUseCase,
  UpdateUserUseCase,
  GetUserByIdUseCase,
  type User,
} from "@nuqta/core";
import {
  getUsersSchema,
  getUserByIdSchema,
  createUserSchema,
  updateUserSchema,
} from "../../../schemas/users.js";
import { requirePermission } from "../../../middleware/rbac.js";

const users: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /users
  fastify.get(
    "/",
    { schema: getUsersSchema, preHandler: requirePermission("users:read") },
    async (request) => {
      const uc = new GetUsersUseCase(fastify.repos.user);
      const data = await uc.execute();
      return { ok: true, data };
    },
  );

  fastify.get(
    "/:id",
    { schema: getUserByIdSchema, preHandler: requirePermission("users:read") },
    async (request) => {
      const { id } = request.params as { id: string };
      const uc = new GetUserByIdUseCase(fastify.repos.user);
      const data = await uc.execute(Number(id));
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
      const data = await uc.execute(body);
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
      const data = await uc.execute(id, body);
      return { ok: true, data };
    },
  );
};

export default users;
