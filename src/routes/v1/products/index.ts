import { FastifyPluginAsync } from "fastify";
import {
  GetProductsUseCase,
  GetProductByIdUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
  AdjustProductStockUseCase,
  ReconcileStockUseCase,
  CreateProductUnitUseCase,
  UpdateProductUnitUseCase,
  SetDefaultProductUnitUseCase,
  CreateProductBatchUseCase,
  GetProductPurchaseHistoryUseCase,
  GetProductSalesHistoryUseCase,
} from "../../../domain/index.js";
import { requirePermission } from "../../../middleware/rbac.js";

const products: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /products
  fastify.get(
    "/",
    {
      schema: {},
      preHandler: requirePermission("products:read"),
    },
    async (request) => {
      const query = request.query as {
        search?: string;
        page?: string;
        limit?: string;
        barcode?: string;
        categoryId?: string;
        supplierId?: string;
        status?: string;
        lowStockOnly?: string;
        expiringSoonOnly?: string;
        isExpire?: string;
      };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const uc = new GetProductsUseCase(fastify.repos.product);
      const data = await uc.execute({
        search: query.search,
        barcode: query.barcode,
        page,
        limit,
        categoryId: query.categoryId
          ? parseInt(query.categoryId, 10)
          : undefined,
        supplierId: query.supplierId
          ? parseInt(query.supplierId, 10)
          : undefined,
        status: query.status,
        lowStockOnly: query.lowStockOnly === "true",
        expiringSoonOnly: query.expiringSoonOnly === "true",
        isExpire: query.isExpire === "true",
      });
      return { ok: true, data: { ...data, page, limit } };
    },
  );

  // GET /products/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {},
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
      schema: {},
      preHandler: requirePermission("products:create"),
    },
    async (request) => {
      const body = request.body as any;
      const uc = new CreateProductUseCase(
        fastify.repos.product,
        fastify.repos.audit,
      );
      const data = await uc.execute(
        body,
        String(request.user?.sub ?? "system"),
      );

      fastify.emitDomainEvent("product:created", {
        id: data.id,
        name: data.name,
      });

      return { ok: true, data };
    },
  );

  // PUT /products/:id
  fastify.put<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {},
      preHandler: requirePermission("products:update"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as any;
      const uc = new UpdateProductUseCase(
        fastify.repos.product,
        fastify.repos.audit,
      );
      const data = await uc.execute(
        { id, productData: body },
        String(request.user?.sub ?? "system"),
      );

      fastify.emitDomainEvent("product:updated", {
        id: data.id,
        name: data.name,
      });

      return { ok: true, data };
    },
  );

  // DELETE /products/:id
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {},
      preHandler: requirePermission("products:delete"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new DeleteProductUseCase(
        fastify.repos.product,
        fastify.repos.audit,
      );
      await uc.execute(id, String(request.user?.sub ?? "system"));

      fastify.emitDomainEvent("product:deleted", { id });

      return { ok: true, data: null };
    },
  );

  // POST /products/:id/adjust-stock
  fastify.post<{ Params: { id: string } }>(
    "/:id/adjust-stock",
    {
      schema: {},
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
      const userId = String(request.user?.sub ?? "system");
      const uc = new AdjustProductStockUseCase(
        fastify.repos.product,
        fastify.repos.inventory,
        fastify.repos.accounting,
        fastify.repos.audit,
        fastify.repos.settings,
        fastify.repos.accountingSettings,
      );
      const data = await uc.execute({ productId: id, ...body }, userId);

      fastify.emitDomainEvent("inventory:adjusted", {
        productId: id,
        quantityChange: body.quantityChange,
      });

      return { ok: true, data };
    },
  );

  // POST /products/:id/reconcile
  fastify.post<{ Params: { id: string } }>(
    "/:id/reconcile",
    {
      schema: {},
      preHandler: requirePermission("inventory:reconcile"),
    },
    async (request) => {
      const uc = new ReconcileStockUseCase(
        fastify.repos.product,
        fastify.repos.inventory,
      );
      const data = await uc.execute(
        undefined,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // ── Product Units ────────────────────────────────────────────────

  // GET /products/:id/units
  fastify.get<{ Params: { id: string } }>(
    "/:id/units",
    {
      schema: {},
      preHandler: requirePermission("products:read"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const data = await fastify.repos.product.findUnitsByProductId(productId);
      return { ok: true, data };
    },
  );

  // POST /products/:id/units
  fastify.post<{ Params: { id: string } }>(
    "/:id/units",
    {
      schema: {},
      preHandler: requirePermission("products:create"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const body = request.body as any;
      const uc = new CreateProductUnitUseCase(fastify.repos.product);
      const data = await uc.execute(
        { productId, data: body },
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // PUT /products/units/:id
  fastify.put<{ Params: { id: string } }>(
    "/units/:id",
    {
      schema: {},
      preHandler: requirePermission("products:update"),
    },
    async (request) => {
      const unitId = parseInt(request.params.id, 10);
      const body = request.body as any;
      const uc = new UpdateProductUnitUseCase(fastify.repos.product);
      const data = await uc.execute(
        { unitId, data: body },
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // DELETE /products/units/:id
  fastify.delete<{ Params: { id: string } }>(
    "/units/:id",
    {
      schema: {},
      preHandler: requirePermission("products:delete"),
    },
    async (request) => {
      const unitId = parseInt(request.params.id, 10);
      await fastify.repos.product.deleteUnit(unitId);
      return { ok: true, data: null };
    },
  );

  // POST /products/:id/units/:uid/set-default
  fastify.post<{ Params: { id: string; uid: string } }>(
    "/:id/units/:uid/set-default",
    {
      schema: {},
      preHandler: requirePermission("products:update"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const unitId = parseInt(request.params.uid, 10);
      const uc = new SetDefaultProductUnitUseCase(fastify.repos.product);
      await uc.execute(
        { productId, unitId },
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data: null };
    },
  );

  // ── Product Batches ──────────────────────────────────────────────

  // GET /products/:id/batches
  fastify.get<{ Params: { id: string } }>(
    "/:id/batches",
    {
      schema: {},
      preHandler: requirePermission("products:read"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const data =
        await fastify.repos.product.findBatchesByProductId(productId);
      return { ok: true, data };
    },
  );

  // POST /products/:id/batches
  fastify.post<{ Params: { id: string } }>(
    "/:id/batches",
    {
      schema: {},
      preHandler: requirePermission("products:create"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const body = request.body as any;
      const uc = new CreateProductBatchUseCase(fastify.repos.product);
      const data = await uc.execute(
        { productId, data: body },
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // GET /products/:id/sales-history
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string };
  }>(
    "/:id/sales-history",
    {
      schema: {},
      preHandler: requirePermission("products:read"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const limit = parseInt(request.query.limit || "50", 10);
      const offset = parseInt(request.query.offset || "0", 10);
      const uc = new GetProductSalesHistoryUseCase(
        fastify.repos.productWorkspace,
      );
      const result = await uc.execute(
        { productId, opts: { limit, offset } },
        String(request.user?.sub ?? "system"),
      );
      return {
        ok: true,
        data: { items: result.items, total: result.items.length },
      };
    },
  );

  // GET /products/:id/purchase-history
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string };
  }>(
    "/:id/purchase-history",
    {
      schema: {},
      preHandler: requirePermission("products:read"),
    },
    async (request) => {
      const productId = parseInt(request.params.id, 10);
      const limit = parseInt(request.query.limit || "50", 10);
      const offset = parseInt(request.query.offset || "0", 10);
      const uc = new GetProductPurchaseHistoryUseCase(
        fastify.repos.productWorkspace,
      );
      const result = await uc.execute(
        { productId, opts: { limit, offset } },
        String(request.user?.sub ?? "system"),
      );
      return {
        ok: true,
        data: { items: result.items, total: result.items.length },
      };
    },
  );
};

export default products;
