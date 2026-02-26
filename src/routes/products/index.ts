import { FastifyPluginAsync } from "fastify";
import {
  GetProductsUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
  AdjustProductStockUseCase,
  ReconcileStockUseCase,
} from "@nuqta/core";

const products: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /products
  fastify.get("/", async (request) => {
    const query = request.query as {
      search?: string;
      page?: string;
      limit?: string;
      categoryId?: string;
      supplierId?: string;
      status?: string;
      lowStockOnly?: string;
      expiringSoonOnly?: string;
    };
    const uc = new GetProductsUseCase(fastify.repos.product);
    const data = await uc.execute({
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      categoryId: query.categoryId ? parseInt(query.categoryId, 10) : undefined,
      supplierId: query.supplierId ? parseInt(query.supplierId, 10) : undefined,
      status: query.status,
      lowStockOnly: query.lowStockOnly === "true",
      expiringSoonOnly: query.expiringSoonOnly === "true",
    });
    return { ok: true, data };
  });

  // POST /products
  fastify.post("/", async (request) => {
    const body = request.body as any;
    const uc = new CreateProductUseCase(
      fastify.repos.product,
      fastify.repos.audit,
    );
    const data = await uc.execute(body);
    return { ok: true, data };
  });

  // PUT /products/:id
  fastify.put<{ Params: { id: string } }>("/:id", async (request) => {
    const id = parseInt(request.params.id, 10);
    const body = request.body as any;
    const uc = new UpdateProductUseCase(
      fastify.repos.product,
      fastify.repos.audit,
    );
    const data = await uc.execute(id, body);
    return { ok: true, data };
  });

  // DELETE /products/:id
  fastify.delete<{ Params: { id: string } }>("/:id", async (request) => {
    const id = parseInt(request.params.id, 10);
    const uc = new DeleteProductUseCase(
      fastify.repos.product,
      fastify.repos.audit,
    );
    await uc.execute(id);
    return { ok: true, data: null };
  });

  // POST /products/:id/adjust-stock
  fastify.post<{ Params: { id: string } }>(
    "/:id/adjust-stock",
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as {
        quantityChange: number;
        reason?: "manual" | "damage" | "opening";
        notes?: string;
        batchId?: number;
        unitName?: string;
        unitFactor?: number;
      };
      const userId = request.user?.sub || 1;
      const uc = new AdjustProductStockUseCase(
        fastify.repos.product,
        fastify.repos.inventory,
        fastify.repos.accounting,
        fastify.repos.audit,
      );
      const data = await uc.execute({ productId: id, ...body }, userId);
      return { ok: true, data };
    },
  );

  // POST /products/:id/reconcile
  fastify.post<{ Params: { id: string } }>(
    "/:id/reconcile",
    async (request) => {
      const uc = new ReconcileStockUseCase(
        fastify.repos.product,
        fastify.repos.inventory,
      );
      const data = await uc.execute();
      return { ok: true, data };
    },
  );
};

export default products;
