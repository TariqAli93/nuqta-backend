import { FastifyPluginAsync } from "fastify";
import {
  CreateSupplierUseCase,
  UpdateSupplierUseCase,
  NotFoundError,
  type Supplier,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const SupplierSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    phone: { type: "string", nullable: true },
    phone2: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    openingBalance: { type: "integer" },
    currentBalance: { type: "integer" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const CreateSupplierBodySchema = {
  type: "object" as const,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    phone2: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    openingBalance: { type: "integer", default: 0 },
    isActive: { type: "boolean", default: true },
  },
  additionalProperties: false,
} as const;

const UpdateSupplierBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    phone2: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    openingBalance: { type: "integer" },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const SupplierListQuerySchema = {
  type: "object" as const,
  properties: {
    search: { type: "string", description: "Search by name" },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const SupplierListSchema = {
  type: "object" as const,
  properties: {
    items: {
      type: "array" as const,
      items: SupplierSchema,
    },
    total: { type: "integer" },
  },
} as const;

const getSuppliersSchema = {
  tags: ["Suppliers"],
  summary: "List suppliers",
  security: [{ bearerAuth: [] }],
  querystring: SupplierListQuerySchema,
  response: {
    200: successEnvelope(
      SupplierListSchema,
      "List of suppliers with pagination",
    ),
    ...ErrorResponses,
  },
} as const;

const getSupplierByIdSchema = {
  tags: ["Suppliers"],
  summary: "Get supplier by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(SupplierSchema, "Supplier details"),
    ...ErrorResponses,
  },
} as const;

const createSupplierSchema = {
  tags: ["Suppliers"],
  summary: "Create a supplier",
  security: [{ bearerAuth: [] }],
  body: CreateSupplierBodySchema,
  response: {
    200: successEnvelope(SupplierSchema, "Created supplier"),
    ...ErrorResponses,
  },
} as const;

const updateSupplierSchema = {
  tags: ["Suppliers"],
  summary: "Update a supplier",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateSupplierBodySchema,
  response: {
    200: successEnvelope(SupplierSchema, "Updated supplier"),
    ...ErrorResponses,
  },
} as const;

const deleteSupplierSchema = {
  tags: ["Suppliers"],
  summary: "Delete a supplier",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

const suppliers: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /suppliers
  fastify.get(
    "/",
    {
      schema: getSuppliersSchema,
      preHandler: requirePermission("suppliers:read"),
    },
    async (request) => {
      const query = request.query as {
        search?: string;
        limit?: string;
        offset?: string;
      };
      const data = await fastify.repos.supplier.findAll({
        search: query.search,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return { ok: true, data };
    },
  );

  // GET /suppliers/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: getSupplierByIdSchema,
      preHandler: requirePermission("suppliers:read"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const data = await fastify.repos.supplier.findById(id);
      if (!data) {
        throw new NotFoundError("المورد غير موجود");
      }
      return { ok: true, data };
    },
  );

  // POST /suppliers
  fastify.post(
    "/",
    {
      schema: createSupplierSchema,
      preHandler: requirePermission("suppliers:create"),
    },
    async (request) => {
      const body = request.body as Supplier;
      const uc = new CreateSupplierUseCase(fastify.repos.supplier);
      const data = await uc.execute(body);
      return { ok: true, data };
    },
  );

  // PUT /suppliers/:id
  fastify.put<{ Params: { id: string } }>(
    "/:id",
    {
      schema: updateSupplierSchema,
      preHandler: requirePermission("suppliers:update"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as Partial<Supplier>;
      const uc = new UpdateSupplierUseCase(fastify.repos.supplier);
      const data = await uc.execute({ id, data: body });
      return { ok: true, data };
    },
  );

  // DELETE /suppliers/:id
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      schema: deleteSupplierSchema,
      preHandler: requirePermission("suppliers:delete"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      await fastify.repos.supplier.delete(id);
      return { ok: true, data: null };
    },
  );
};

export default suppliers;
