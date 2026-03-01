import { FastifyPluginAsync } from "fastify";
import {
  GetCategoriesUseCase,
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
  type Category,
} from "@nuqta/core";
import {
  getCategoriesSchema,
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} from "../../../schemas/categories.js";

const categories: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /categories
  fastify.get("/", { schema: getCategoriesSchema }, async (request) => {
    const uc = new GetCategoriesUseCase(fastify.repos.category);
    const data = await uc.execute();
    return { ok: true, data };
  });

  // POST /categories
  fastify.post("/", { schema: createCategorySchema }, async (request) => {
    const body = request.body as Category;
    const uc = new CreateCategoryUseCase(fastify.repos.category);
    const data = await uc.execute(body);
    return { ok: true, data };
  });

  // PUT /categories/:id
  fastify.put<{ Params: { id: string } }>(
    "/:id",
    { schema: updateCategorySchema },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as Partial<Category>;
      const uc = new UpdateCategoryUseCase(fastify.repos.category);
      const data = await uc.execute(id, body);
      return { ok: true, data };
    },
  );

  // DELETE /categories/:id
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { schema: deleteCategorySchema },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new DeleteCategoryUseCase(fastify.repos.category);
      await uc.execute(id);
      return { ok: true, data: null };
    },
  );
};

export default categories;
