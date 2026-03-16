import { FastifyPluginAsync } from "fastify";
import {
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  type Category,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const CategorySchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const CreateCategoryBodySchema = {
  type: "object" as const,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean", default: true },
  },
  additionalProperties: false,
} as const;

const UpdateCategoryBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const getCategoriesSchema = {
  tags: ["Categories"],
  summary: "List all categories",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(CategorySchema, "List of categories"),
    ...ErrorResponses,
  },
} as const;

const createCategorySchema = {
  tags: ["Categories"],
  summary: "Create a category",
  security: [{ bearerAuth: [] }],
  body: CreateCategoryBodySchema,
  response: {
    200: successEnvelope(CategorySchema, "Created category"),
    ...ErrorResponses,
  },
} as const;

const updateCategorySchema = {
  tags: ["Categories"],
  summary: "Update a category",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateCategoryBodySchema,
  response: {
    200: successEnvelope(CategorySchema, "Updated category"),
    ...ErrorResponses,
  },
} as const;

const deleteCategorySchema = {
  tags: ["Categories"],
  summary: "Delete a category",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

const categories: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /categories
  fastify.get(
    "/",
    {
      schema: getCategoriesSchema,
      preHandler: requirePermission("categories:read"),
    },
    async (request) => {
      const data = await fastify.repos.category.findAll();
      return { ok: true, data };
    },
  );

  // POST /categories
  fastify.post(
    "/",
    {
      schema: createCategorySchema,
      preHandler: requirePermission("categories:create"),
    },
    async (request) => {
      const body = request.body as Category;
      const uc = new CreateCategoryUseCase(fastify.repos.category);
      const data = await uc.execute(
        body,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // PUT /categories/:id
  fastify.put<{ Params: { id: string } }>(
    "/:id",
    {
      schema: updateCategorySchema,
      preHandler: requirePermission("categories:update"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as Partial<Category>;
      const uc = new UpdateCategoryUseCase(fastify.repos.category);
      const data = await uc.execute(
        { id, category: body },
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // DELETE /categories/:id
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      schema: deleteCategorySchema,
      preHandler: requirePermission("categories:delete"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      await fastify.repos.category.delete(id);
      return { ok: true, data: null };
    },
  );
};

export default categories;
