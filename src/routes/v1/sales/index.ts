import { FastifyPluginAsync } from "fastify";
import {
  GetSaleByIdUseCase,
  CreateSaleUseCase,
  AddPaymentUseCase,
  CancelSaleUseCase,
  RefundSaleUseCase,
  GetSaleReceiptUseCase,
  NotFoundError,
  type CreateSaleInput,
  type AddPaymentInput,
} from "@nuqta/core";
import { FifoService } from "@nuqta/data";
import {
  ErrorResponses,
  successEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const SaleItemSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    saleId: { type: "integer" },
    productId: { type: "integer" },
    productName: { type: "string" },
    quantity: { type: "integer" },
    unitName: { type: "string" },
    unitFactor: { type: "integer" },
    quantityBase: { type: "integer" },
    batchId: { type: "integer", nullable: true },
    unitPrice: { type: "integer" },
    discount: { type: "integer" },
    subtotal: { type: "integer" },
    cogs: { type: "integer", nullable: true },
    weightedAverageCost: { type: "integer", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const SaleSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    invoiceNumber: { type: "string" },
    customerId: { type: "integer", nullable: true },
    subtotal: { type: "integer" },
    discount: { type: "integer" },
    tax: { type: "integer" },
    total: { type: "integer" },
    currency: { type: "string" },
    exchangeRate: { type: "number" },
    interestRate: { type: "integer" },
    interestAmount: { type: "integer" },
    paymentType: { type: "string", enum: ["cash", "credit", "mixed"] },
    paidAmount: { type: "integer" },
    remainingAmount: { type: "integer" },
    status: { type: "string", enum: ["pending", "completed", "cancelled"] },
    notes: { type: "string", nullable: true },
    idempotencyKey: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
    items: { type: "array", items: SaleItemSchema },
    cogs: { type: "integer", nullable: true },
    totalCogs: { type: "integer", nullable: true },
    profit: { type: "integer", nullable: true },
    marginBps: { type: "integer", nullable: true },
  },
};

const SaleListQuerySchema = {
  type: "object" as const,
  properties: {
    page: { type: "string", pattern: "^\\d+$" },
    limit: { type: "string", pattern: "^\\d+$" },
    startDate: {
      type: "string",
      format: "date",
      description: "Filter from date",
    },
    endDate: { type: "string", format: "date", description: "Filter to date" },
  },
} as const;

const CreateSaleItemSchema = {
  type: "object" as const,
  required: ["productId", "quantity", "unitPrice"],
  properties: {
    productId: { type: "integer", minimum: 1 },
    quantity: { type: "integer", minimum: 1 },
    unitPrice: { type: "integer", minimum: 0 },
    discount: { type: "integer", minimum: 0 },
    unitName: { type: "string" },
    unitFactor: { type: "integer", minimum: 1 },
    batchId: { type: "integer" },
  },
};

const CreateSaleBodySchema = {
  type: "object" as const,
  required: ["items", "paymentType"],
  properties: {
    items: { type: "array", items: CreateSaleItemSchema, minItems: 1 },
    customerId: { type: "integer" },
    discount: { type: "integer", minimum: 0 },
    tax: { type: "integer", minimum: 0 },
    paymentType: { type: "string", enum: ["cash", "credit", "mixed"] },
    paidAmount: { type: "integer", minimum: 0 },
    currency: { type: "string" },
    notes: { type: "string" },
    interestRate: { type: "integer" },
    interestRateBps: { type: "integer" },
    paymentMethod: {
      type: "string",
      enum: ["cash", "card", "bank_transfer", "credit"],
    },
    referenceNumber: { type: "string" },
    idempotencyKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

const AddSalePaymentBodySchema = {
  type: "object" as const,
  required: ["amount", "paymentMethod"],
  properties: {
    customerId: { type: "integer" },
    amount: { type: "integer", minimum: 1 },
    currency: { type: "string" },
    exchangeRate: { type: "number" },
    paymentMethod: {
      type: "string",
      enum: ["cash", "card", "bank_transfer", "credit"],
    },
    referenceNumber: { type: "string" },
    notes: { type: "string" },
    idempotencyKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

const RefundSaleBodySchema = {
  type: "object" as const,
  required: ["amount"],
  properties: {
    amount: {
      type: "integer",
      minimum: 1,
      description: "Refund amount in minor units",
    },
    reason: { type: "string" },
  },
  additionalProperties: false,
} as const;

export const getSalesSchema = {
  tags: ["Sales"],
  summary: "List sales",
  security: [{ bearerAuth: [] }],
  querystring: SaleListQuerySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          items: { type: "array" as const, items: SaleSchema },
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
        },
      },
      "Paginated sales list",
    ),
    ...ErrorResponses,
  },
} as const;

const getSaleByIdSchema = {
  tags: ["Sales"],
  summary: "Get sale by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(SaleSchema, "Sale details"),
    ...ErrorResponses,
  },
} as const;

const createSaleSchema = {
  tags: ["Sales"],
  summary: "Create a sale",
  description: "Create a new sale with line items and payment information.",
  security: [{ bearerAuth: [] }],
  body: CreateSaleBodySchema,
  response: {
    200: successEnvelope(SaleSchema, "Created sale"),
    ...ErrorResponses,
  },
} as const;

const addSalePaymentSchema = {
  tags: ["Sales"],
  summary: "Add payment to a sale",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: AddSalePaymentBodySchema,
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Payment result",
    ),
    ...ErrorResponses,
  },
} as const;

const cancelSaleSchema = {
  tags: ["Sales"],
  summary: "Cancel a sale",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

const refundSaleSchema = {
  tags: ["Sales"],
  summary: "Refund a sale",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: RefundSaleBodySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          saleId: { type: "integer" },
          refundedAmount: { type: "integer" },
          newPaidAmount: { type: "integer" },
          newRemainingAmount: { type: "integer" },
        },
      },
      "Refund result",
    ),
    ...ErrorResponses,
  },
} as const;

const getSaleReceiptSchema = {
  tags: ["Sales"],
  summary: "Get sale receipt",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope({ type: "string" }, "Receipt content"),
    ...ErrorResponses,
  },
} as const;

const sales: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /sales
  fastify.get(
    "/",
    { schema: getSalesSchema, preHandler: requirePermission("sales:read") },
    async (request) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        startDate?: string;
        endDate?: string;
      };
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const result = await fastify.repos.sale.findAll({
        page,
        limit,
        startDate: query.startDate,
        endDate: query.endDate,
      });
      return { ok: true, data: { ...result, page, limit } };
    },
  );

  // GET /sales/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { schema: getSaleByIdSchema, preHandler: requirePermission("sales:read") },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new GetSaleByIdUseCase(fastify.repos.sale);
      const data = await uc.execute(id);
      if (!data) {
        throw new NotFoundError("الفاتورة غير موجودة");
      }
      return { ok: true, data };
    },
  );

  // POST /sales
  fastify.post(
    "/",
    { schema: createSaleSchema, preHandler: requirePermission("sales:create") },
    async (request) => {
      const body = request.body as CreateSaleInput;
      const userId = request.user?.sub || 1;
      const fifoService = new FifoService(fastify.db);
      const uc = new CreateSaleUseCase(
        fastify.repos.sale,
        fastify.repos.product,
        fastify.repos.customer,
        fastify.repos.settings,
        fastify.repos.payment,
        fastify.repos.inventory,
        fastify.repos.accounting,
        fastify.repos.customerLedger,
        fastify.repos.audit,
        fifoService,
      );
      const result = await uc.executeCommitPhase(body, userId);

      // Emit real-time event for other terminals
      fastify.eventBus.emit("sale:created", {
        id: result.createdSale.id,
        total: result.createdSale.total,
        itemCount: result.createdSale.items?.length ?? 0,
      });

      return { ok: true, data: result.createdSale };
    },
  );

  // POST /sales/:id/payments
  fastify.post<{ Params: { id: string } }>(
    "/:id/payments",
    {
      schema: addSalePaymentSchema,
      preHandler: requirePermission("sales:payment"),
    },
    async (request) => {
      const saleId = parseInt(request.params.id, 10);
      const body = request.body as Omit<AddPaymentInput, "saleId">;
      const userId = request.user?.sub || 1;
      const uc = new AddPaymentUseCase(
        fastify.repos.sale,
        fastify.repos.payment,
        fastify.repos.customer,
        fastify.repos.customerLedger,
        fastify.repos.accounting,
        fastify.repos.settings,
        fastify.repos.audit,
      );
      const result = await uc.execute({ saleId, ...body }, userId);
      return { ok: true, data: result };
    },
  );

  // POST /sales/:id/cancel
  fastify.post<{ Params: { id: string } }>(
    "/:id/cancel",
    { schema: cancelSaleSchema, preHandler: requirePermission("sales:cancel") },
    async (request) => {
      const saleId = parseInt(request.params.id, 10);
      const userId = request.user?.sub || 1;
      const uc = new CancelSaleUseCase(fastify.repos.sale);
      await uc.execute(saleId, userId);

      fastify.eventBus.emit("sale:cancelled", { id: saleId });

      return { ok: true, data: null };
    },
  );

  // POST /sales/:id/refund
  fastify.post<{ Params: { id: string } }>(
    "/:id/refund",
    { schema: refundSaleSchema, preHandler: requirePermission("sales:refund") },
    async (request) => {
      const saleId = parseInt(request.params.id, 10);
      const body = request.body as { amount: number; reason?: string };
      const userId = request.user?.sub || 1;
      const uc = new RefundSaleUseCase(fastify.repos.sale);
      const data = await uc.execute(
        { saleId, amount: body.amount, reason: body.reason },
        userId,
      );
      return { ok: true, data };
    },
  );

  // GET /sales/:id/receipt
  fastify.get<{ Params: { id: string } }>(
    "/:id/receipt",
    {
      schema: getSaleReceiptSchema,
      preHandler: requirePermission("sales:receipt"),
    },
    async (request) => {
      const saleId = parseInt(request.params.id, 10);
      const uc = new GetSaleReceiptUseCase(fastify.repos.sale);
      const data = await uc.execute(saleId);
      return { ok: true, data };
    },
  );
};

export default sales;
