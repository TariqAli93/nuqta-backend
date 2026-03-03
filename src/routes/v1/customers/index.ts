import { FastifyPluginAsync } from "fastify";
import {
  GetCustomersUseCase,
  GetCustomerByIdUseCase,
  CreateCustomerUseCase,
  UpdateCustomerUseCase,
  DeleteCustomerUseCase,
  type Customer,
} from "@nuqta/core";
import {
  getCustomersSchema,
  getCustomerByIdSchema,
  createCustomerSchema,
  updateCustomerSchema,
  deleteCustomerSchema,
} from "../../../schemas/customers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const customers: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /customers
  fastify.get(
    "/",
    {
      schema: getCustomersSchema,
      preHandler: requirePermission("customers:read"),
    },
    async (request) => {
      const query = request.query as {
        search?: string;
        page?: string;
        limit?: string;
      };
      const uc = new GetCustomersUseCase(fastify.repos.customer);
      const data = await uc.execute({
        search: query.search,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.page
          ? (parseInt(query.page, 10) - 1) *
            (query.limit ? parseInt(query.limit, 10) : 20)
          : undefined,
      });
      return { ok: true, data };
    },
  );

  // GET /customers/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: getCustomerByIdSchema,
      preHandler: requirePermission("customers:read"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new GetCustomerByIdUseCase(fastify.repos.customer);
      const data = await uc.execute(id);
      return { ok: true, data };
    },
  );

  // POST /customers
  fastify.post(
    "/",
    {
      schema: createCustomerSchema,
      preHandler: requirePermission("customers:create"),
    },
    async (request) => {
      const body = request.body as Customer;
      const uc = new CreateCustomerUseCase(fastify.repos.customer);
      const data = await uc.execute(body);
      return { ok: true, data };
    },
  );

  // PUT /customers/:id
  fastify.put<{ Params: { id: string } }>(
    "/:id",
    {
      schema: updateCustomerSchema,
      preHandler: requirePermission("customers:update"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as Partial<Customer>;
      const uc = new UpdateCustomerUseCase(fastify.repos.customer);
      const data = await uc.execute(id, body);
      return { ok: true, data };
    },
  );

  // DELETE /customers/:id
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      schema: deleteCustomerSchema,
      preHandler: requirePermission("customers:delete"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new DeleteCustomerUseCase(fastify.repos.customer);
      await uc.execute(id);
      return { ok: true, data: null };
    },
  );
};

export default customers;
