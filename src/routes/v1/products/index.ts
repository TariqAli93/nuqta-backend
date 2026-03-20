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
import {
  ErrorResponses,
  successEnvelope,
  successPaginatedEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";

// ── Shared sub-schemas ─────────────────────────────────────────────

const ProductSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    sku: { type: "string", nullable: true },
    barcode: { type: "string", nullable: true },
    categoryId: { type: "integer", nullable: true },
    description: { type: "string", nullable: true },
    costPrice: { type: "integer" },
    sellingPrice: { type: "integer" },
    currency: { type: "string" },
    stock: { type: "integer" },
    minStock: { type: "integer" },
    unit: { type: "string" },
    supplier: { type: "string", nullable: true },
    supplierId: { type: "integer", nullable: true },
    expireDate: { type: "string", nullable: true, format: "date-time" },
    isExpire: { type: "boolean" },
    status: { type: "string", enum: ["available", "out_of_stock", "discontinued"] },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const PurchaseHistoryItemSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    purchaseId: { type: "integer" },
    invoiceNumber: { type: "string" },
    quantity: { type: "number" },
    unitName: { type: "string" },
    unitFactor: { type: "number" },
    quantityBase: { type: "number" },
    unitCost: { type: "integer" },
    lineSubtotal: { type: "integer" },
    batchId: { type: "integer", nullable: true },
    expiryDate: { type: "string", nullable: true, format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    supplierName: { type: "string", nullable: true },
  },
};

const SalesHistoryItemSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    saleId: { type: "integer" },
    invoiceNumber: { type: "string" },
    quantity: { type: "number" },
    unitName: { type: "string" },
    unitFactor: { type: "number" },
    quantityBase: { type: "number" },
    unitPrice: { type: "integer" },
    subtotal: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
    customerName: { type: "string", nullable: true },
  },
};

// ── Querystring schemas ────────────────────────────────────────────

const ProductsQuerySchema = {
  type: "object" as const,
  properties: {
    search: { type: "string" },
    page: { type: "string", pattern: "^\\d+$" },
    limit: { type: "string", pattern: "^\\d+$" },
    categoryId: { type: "string", pattern: "^\\d+$" },
    supplierId: { type: "string", pattern: "^\\d+$" },
    status: { type: "string" },
    lowStockOnly: { type: "string", enum: ["true", "false"] },
    expiringSoonOnly: { type: "string", enum: ["true", "false"] },
  },
  additionalProperties: false,
} as const;

// ── Body schemas ───────────────────────────────────────────────────

const CreateProductBodySchema = {
  type: "object" as const,
  required: ["name", "costPrice", "sellingPrice"],
  properties: {
    name: { type: "string", minLength: 1 },
    sku: { type: "string" },
    barcode: { type: "string" },
    categoryId: { type: "integer" },
    description: { type: "string" },
    costPrice: { type: "integer", minimum: 0 },
    sellingPrice: { type: "integer", minimum: 0 },
    currency: { type: "string" },
    stock: { type: "integer", minimum: 0 },
    minStock: { type: "integer", minimum: 0 },
    unit: { type: "string" },
    supplier: { type: "string" },
    supplierId: { type: "integer" },
    expireDate: { type: "string" },
    isExpire: { type: "boolean" },
    status: { type: "string", enum: ["available", "out_of_stock", "discontinued"] },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const UpdateProductBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    sku: { type: "string" },
    barcode: { type: "string" },
    categoryId: { type: "integer" },
    description: { type: "string" },
    costPrice: { type: "integer", minimum: 0 },
    sellingPrice: { type: "integer", minimum: 0 },
    currency: { type: "string" },
    stock: { type: "integer", minimum: 0 },
    minStock: { type: "integer", minimum: 0 },
    unit: { type: "string" },
    supplier: { type: "string" },
    supplierId: { type: "integer" },
    expireDate: { type: "string" },
    isExpire: { type: "boolean" },
    status: { type: "string", enum: ["available", "out_of_stock", "discontinued"] },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const AdjustStockBodySchema = {
  type: "object" as const,
  required: ["quantityChange"],
  properties: {
    quantityChange: { type: "integer" },
    reason: { type: "string", enum: ["manual", "damage", "opening"] },
    notes: { type: "string" },
    batchId: { type: "integer" },
    unitName: { type: "string" },
    unitFactor: { type: "number" },
  },
  additionalProperties: false,
} as const;

// ── Exported route schemas (used by response-contract tests) ───────

export const getProductsSchema = {
  tags: ["Products"],
  summary: "List products",
  security: [{ bearerAuth: [] }],
  querystring: ProductsQuerySchema,
  response: {
    200: successPaginatedEnvelope(ProductSchema, "Products", {
      page: { type: "integer" },
      limit: { type: "integer" },
    }),
    ...ErrorResponses,
  },
} as const;

export const getProductPurchaseHistorySchema = {
  tags: ["Products"],
  summary: "Get product purchase history",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successPaginatedEnvelope(PurchaseHistoryItemSchema, "Purchase history"),
    ...ErrorResponses,
  },
} as const;

export const getProductSalesHistorySchema = {
  tags: ["Products"],
  summary: "Get product sales history",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successPaginatedEnvelope(SalesHistoryItemSchema, "Sales history"),
    ...ErrorResponses,
  },
} as const;

// ── Internal route schemas ─────────────────────────────────────────

const getProductByIdSchema = {
  tags: ["Products"],
  params: { $ref: "IdParams#" },
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(ProductSchema, "Product"),
    ...ErrorResponses,
  },
} as const;

const createProductSchema = {
  tags: ["Products"],
  security: [{ bearerAuth: [] }],
  body: CreateProductBodySchema,
  response: {
    200: successEnvelope(ProductSchema, "Created product"),
    ...ErrorResponses,
  },
} as const;

const updateProductSchema = {
  tags: ["Products"],
  params: { $ref: "IdParams#" },
  security: [{ bearerAuth: [] }],
  body: UpdateProductBodySchema,
  response: {
    200: successEnvelope(ProductSchema, "Updated product"),
    ...ErrorResponses,
  },
} as const;

const deleteProductSchema = {
  tags: ["Products"],
  params: { $ref: "IdParams#" },
  security: [{ bearerAuth: [] }],
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

const adjustStockSchema = {
  tags: ["Products"],
  params: { $ref: "IdParams#" },
  security: [{ bearerAuth: [] }],
  body: AdjustStockBodySchema,
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Stock adjustment",
    ),
    ...ErrorResponses,
  },
} as const;

const reconcileStockSchema = {
  tags: ["Products"],
  params: { $ref: "IdParams#" },
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Reconciliation result",
    ),
    ...ErrorResponses,
  },
} as const;

// ── Plugin ─────────────────────────────────────────────────────────

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
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const uc = new GetProductsUseCase(fastify.repos.product);
      const data = await uc.execute({
        search: query.search,
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
      });
      return { ok: true, data: { ...data, page, limit } };
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
      schema: deleteProductSchema,
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
      const userId = String(request.user?.sub ?? "system");
      const uc = new AdjustProductStockUseCase(
        fastify.repos.product,
        fastify.repos.inventory,
        fastify.repos.accounting,
        fastify.repos.audit,
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
      schema: reconcileStockSchema,
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
      schema: getProductSalesHistorySchema,
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
      return { ok: true, data: { items: result.items, total: result.items.length } };
    },
  );

  // GET /products/:id/purchase-history
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string };
  }>(
    "/:id/purchase-history",
    {
      schema: getProductPurchaseHistorySchema,
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
      return { ok: true, data: { items: result.items, total: result.items.length } };
    },
  );
};

export default products;
