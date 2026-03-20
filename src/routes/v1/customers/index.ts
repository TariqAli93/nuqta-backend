import { FastifyPluginAsync } from "fastify";
import {
  GetCustomerByIdUseCase,
  CreateCustomerUseCase,
  UpdateCustomerUseCase,
  type Customer,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const CustomerSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    phone: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    totalPurchases: { type: "integer" },
    totalDebt: { type: "integer" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const CreateCustomerBodySchema = {
  type: "object" as const,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    isActive: { type: "boolean", default: true },
  },
  additionalProperties: false,
} as const;

const UpdateCustomerBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const CustomerListQuerySchema = {
  type: "object" as const,
  properties: {
    search: { type: "string", description: "Search by name" },
    page: {
      type: "string",
      pattern: "^\\d+$",
      description: "Page number (1-based)",
    },
    limit: { type: "string", pattern: "^\\d+$", description: "Items per page" },
    offset: {
      type: "string",
      pattern: "^\\d+$",
      description: "Item offset (alternative to page; takes precedence if both provided)",
    },
  },
} as const;

const CustomerListSchema = {
  type: "object" as const,
  properties: {
    items: {
      type: "array" as const,
      items: CustomerSchema,
    },
    total: { type: "integer" },
  },
} as const;

const getCustomersSchema = {
  tags: ["Customers"],
  summary: "List customers",
  security: [{ bearerAuth: [] }],
  querystring: CustomerListQuerySchema,
  response: {
    200: successEnvelope(CustomerListSchema, "List of customers"),
    ...ErrorResponses,
  },
} as const;

const createCustomerSchema = {
  tags: ["Customers"],
  summary: "Create a customer",
  security: [{ bearerAuth: [] }],
  body: CreateCustomerBodySchema,
  response: {
    200: successEnvelope(CustomerSchema, "Created customer"),
    ...ErrorResponses,
  },
} as const;

const updateCustomerSchema = {
  tags: ["Customers"],
  summary: "Update a customer",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateCustomerBodySchema,
  response: {
    200: successEnvelope(CustomerSchema, "Updated customer"),
    ...ErrorResponses,
  },
} as const;

const deleteCustomerSchema = {
  tags: ["Customers"],
  summary: "Delete a customer",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

const getCustomerByIdSchema = {
  tags: ["Customers"],
  summary: "Get customer by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(CustomerSchema, "Customer details"),
    ...ErrorResponses,
  },
} as const;

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
        offset?: string;
      };
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      let offset: number | undefined;
      if (query.offset !== undefined) {
        // Direct offset takes precedence over page
        offset = parseInt(query.offset, 10);
      } else if (query.page) {
        offset = (parseInt(query.page, 10) - 1) * limit;
      }
      const data = await fastify.repos.customer.findAll({
        search: query.search,
        limit,
        offset,
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
      const data = await uc.execute(
        body,
        String(request.user?.sub ?? "system"),
      );
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
      const data = await uc.execute(
        { id, customer: body },
        String(request.user?.sub ?? "system"),
      );
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
      await fastify.repos.customer.delete(id);
      return { ok: true, data: null };
    },
  );
};

export default customers;
