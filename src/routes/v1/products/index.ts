import { FastifyPluginAsync } from "fastify";
import {
  GetProductsUseCase,
  GetProductByIdUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
  AdjustProductStockUseCase,
  ReconcileStockUseCase,
  GetProductUnitsUseCase,
  CreateProductUnitUseCase,
  UpdateProductUnitUseCase,
  DeleteProductUnitUseCase,
  SetDefaultProductUnitUseCase,
  GetProductBatchesUseCase,
  CreateProductBatchUseCase,
} from "@nuqta/core";
import {
  getProductsSchema,
  getProductByIdSchema,
  createProductSchema,
  updateProductSchema,
  deleteProductSchema,
  adjustStockSchema,
  reconcileStockSchema,
  getProductUnitsSchema,
  createProductUnitSchema,
  updateProductUnitSchema,
  deleteProductUnitSchema,
  setDefaultUnitSchema,
  getProductBatchesSchema,
  createProductBatchSchema,
} from "../../../schemas/products.js";
import { requirePermission } from "../../../middleware/rbac.js";

const products: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /products
  fastify.get(
    "/",
    {
      schema: getProductsSchema,
      preHandler: requirePermission("products:read"),
    },
    async (request) => {
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
        categoryId: query.categoryId
          ? parseInt(query.categoryId, 10)
          : undefined,
        supplierId: query.supplierId
          ? parseInt(query.supplierId, 10)
          : undefined,
        status: query.status,
        lowStockOnly: query.lowStockOnly === "true",
        expiringSoonOnly: query.expiringSoonOnly === "true",
      });
      return { ok: true, data };
    },
  );

  // GET /products/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: getProductByIdSchema,
      preHandler: requirePermission("products:read"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new GetProductByIdUseCase(fastify.repos.product);
      const data = await uc.execute(id);
      return { ok: true, data };
    },
  );

  // POST /products
  fastify.post(
    "/",
    {
      schema: createProductSchema,
      preHandler: requirePermission("products:create"),
    },
    async (request) => {
      const body = request.body as any;
      const uc = new CreateProductUseCase(
        fastify.repos.product,
        fastify.repos.audit,
      );
      const data = await uc.execute(body);
      return { ok: true, data };
    },
  );

  // PUT /products/:id
  fastify.put<{ Params: { id: string } }>(
    "/:id",
    {
      schema: updateProductSchema,
      preHandler: requirePermission("products:update"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as any;
      const uc = new UpdateProductUseCase(
        fastify.repos.product,
        fastify.repos.audit,
      );
      const data = await uc.execute(id, body);
      return { ok: true, data };
    },
  );

  // DELETE /products/:id
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      schema: deleteProductSchema,
      preHandler: requirePermission("products:delete"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new DeleteProductUseCase(
        fastify.repos.product,
        fastify.repos.audit,
      );
      await uc.execute(id);
      return { ok: true, data: null };
    },
  );

  // POST /products/:id/adjust-stock
  fastify.post<{ Params: { id: string } }>(
    "/:id/adjust-stock",
    {
      schema: adjustStockSchema,
      preHandler: requirePermission("inventory:update"),
    },
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
    {
      schema: reconcileStockSchema,
      preHandler: requirePermission("inventory:reconcile"),
    },
    async (request) => {
      const uc = new ReconcileStockUseCase(
        fastify.repos.product,
        fastify.repos.inventory,
      );
      const data = await uc.execute();
      return { ok: true, data };
    },
  );

  // ── Product Units ────────────────────────────────────────────────

  // GET /products/:id/units
  fastify.get<{ Params: { id: string } }>(
    "/:id/units",
    {
      schema: getProductUnitsSchema,
      preHandler: requirePermission("products:read"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const uc = new GetProductUnitsUseCase(fastify.repos.product);
      const data = await uc.execute(productId);
      return { ok: true, data };
    },
  );

  // POST /products/:id/units
  fastify.post<{ Params: { id: string } }>(
    "/:id/units",
    {
      schema: createProductUnitSchema,
      preHandler: requirePermission("products:create"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const body = request.body as any;
      const uc = new CreateProductUnitUseCase(fastify.repos.product);
      const data = await uc.execute(productId, body);
      return { ok: true, data };
    },
  );

  // PUT /products/units/:id
  fastify.put<{ Params: { id: string } }>(
    "/units/:id",
    {
      schema: updateProductUnitSchema,
      preHandler: requirePermission("products:update"),
    },
    async (request) => {
      const unitId = parseInt(request.params.id, 10);
      const body = request.body as any;
      const uc = new UpdateProductUnitUseCase(fastify.repos.product);
      const data = await uc.execute(unitId, body);
      return { ok: true, data };
    },
  );

  // DELETE /products/units/:id
  fastify.delete<{ Params: { id: string } }>(
    "/units/:id",
    {
      schema: deleteProductUnitSchema,
      preHandler: requirePermission("products:delete"),
    },
    async (request) => {
      const unitId = parseInt(request.params.id, 10);
      const uc = new DeleteProductUnitUseCase(fastify.repos.product);
      await uc.execute(unitId);
      return { ok: true, data: null };
    },
  );

  // POST /products/:id/units/:uid/set-default
  fastify.post<{ Params: { id: string; uid: string } }>(
    "/:id/units/:uid/set-default",
    {
      schema: setDefaultUnitSchema,
      preHandler: requirePermission("products:update"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const unitId = parseInt(request.params.uid, 10);
      const uc = new SetDefaultProductUnitUseCase(fastify.repos.product);
      await uc.execute(productId, unitId);
      return { ok: true, data: null };
    },
  );

  // ── Product Batches ──────────────────────────────────────────────

  // GET /products/:id/batches
  fastify.get<{ Params: { id: string } }>(
    "/:id/batches",
    {
      schema: getProductBatchesSchema,
      preHandler: requirePermission("products:read"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const uc = new GetProductBatchesUseCase(fastify.repos.product);
      const data = await uc.execute(productId);
      return { ok: true, data };
    },
  );

  // POST /products/:id/batches
  fastify.post<{ Params: { id: string } }>(
    "/:id/batches",
    {
      schema: createProductBatchSchema,
      preHandler: requirePermission("products:create"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const body = request.body as any;
      const uc = new CreateProductBatchUseCase(fastify.repos.product);
      const data = await uc.execute(productId, body);
      return { ok: true, data };
    },
  );
};

export default products;
