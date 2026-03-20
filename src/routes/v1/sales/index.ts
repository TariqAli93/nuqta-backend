import { FastifyPluginAsync } from "fastify";
import {
  CreateSaleUseCase,
  AddPaymentUseCase,
  CancelSaleUseCase,
  RefundSaleUseCase,
  GetSaleReceiptUseCase,
  SettleSaleUseCase,
  NotFoundError,
  type CreateSaleInput,
  type AddPaymentInput,
} from "../../../domain/index.js";
import { FifoService } from "../../../data/index.js";
import {
  ErrorResponses,
  successEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";
import { SaleReceiptSchema } from "../../../schemas/sale-receipt.js";

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
    refundedAmount: { type: "integer" },
    remainingAmount: { type: "integer" },
    status: {
      type: "string",
      enum: ["pending", "completed", "cancelled", "refunded", "partial_refund"],
    },
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
    returnItems: {
      type: "array",
      description: "Items being physically returned to inventory",
      items: {
        type: "object",
        required: ["saleItemId", "quantity"],
        properties: {
          saleItemId: { type: "integer", minimum: 1 },
          quantity: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    },
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

const settleSaleBodySchema = {
  type: "object" as const,
  properties: {
    paymentMethod: {
      type: "string",
      enum: ["cash", "card", "bank_transfer", "credit"],
      description:
        "Payment method used to clear the remaining balance (defaults to cash)",
    },
    referenceNumber: { type: "string" },
    notes: { type: "string" },
    idempotencyKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

const settleSaleSchema = {
  tags: ["Sales"],
  summary: "Settle a sale",
  description:
    "Clears the full remaining balance of a pending or partial sale, marking it as completed.",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: settleSaleBodySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          saleId: { type: "integer" },
          settledAmount: { type: "integer" },
          newStatus: { type: "string" },
        },
      },
      "Settlement result",
    ),
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
          totalRefunded: { type: "integer" },
          newPaidAmount: { type: "integer" },
          newRemainingAmount: { type: "integer" },
          status: { type: "string" },
        },
      },
      "Refund result",
    ),
    ...ErrorResponses,
  },
} as const;

export const getSaleReceiptSchema = {
  tags: ["Sales"],
  summary: "Get sale receipt",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(SaleReceiptSchema, "Receipt data"),
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
      const data = await fastify.repos.sale.findById(id);
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
      const userId = String(request.user?.sub ?? "system");
      const fifoService = new FifoService(fastify.db);
      const uc = new CreateSaleUseCase(
        fastify.db,
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
        fastify.repos.accountingSettings,
      );
      const createdSale = await uc.execute(body, userId);

      // Emit real-time event for other terminals
      fastify.emitDomainEvent("sale:created", {
        id: createdSale.id,
        total: createdSale.total,
        itemCount: createdSale.items?.length ?? 0,
      });

      return { ok: true, data: createdSale };
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
      const userId = String(request.user?.sub ?? "system");
      const uc = new AddPaymentUseCase(
        fastify.db,
        fastify.repos.sale,
        fastify.repos.payment,
        fastify.repos.customer,
        fastify.repos.customerLedger,
        fastify.repos.accounting,
        fastify.repos.settings,
        fastify.repos.audit,
        fastify.repos.accountingSettings,
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
      const userId = String(request.user?.sub ?? "system");
      const uc = new CancelSaleUseCase(
        fastify.db,
        fastify.repos.sale,
        fastify.repos.inventory,
        fastify.repos.accounting,
        fastify.repos.customerLedger,
        fastify.repos.payment,
        fastify.repos.settings,
        fastify.repos.audit,
        fastify.repos.product,
      );
      await uc.execute({ saleId }, userId);

      fastify.emitDomainEvent("sale:cancelled", { id: saleId });

      return { ok: true, data: null };
    },
  );

  // POST /sales/:id/refund
  fastify.post<{ Params: { id: string } }>(
    "/:id/refund",
    { schema: refundSaleSchema, preHandler: requirePermission("sales:refund") },
    async (request) => {
      const saleId = parseInt(request.params.id, 10);
      const body = request.body as {
        amount: number;
        reason?: string;
        returnItems?: { saleItemId: number; quantity: number }[];
      };
      const userId = String(request.user?.sub ?? "system");
      const uc = new RefundSaleUseCase(
        fastify.db,
        fastify.repos.sale,
        fastify.repos.payment,
        fastify.repos.inventory,
        fastify.repos.accounting,
        fastify.repos.customerLedger,
        fastify.repos.settings,
        fastify.repos.audit,
        fastify.repos.product,
      );
      const data = await uc.execute(
        {
          saleId,
          amount: body.amount,
          reason: body.reason,
          returnItems: body.returnItems,
        },
        userId,
      );

      fastify.emitDomainEvent("sale:refunded", {
        id: saleId,
        refundedAmount: data.refundedAmount,
        totalRefunded: data.totalRefunded,
        newPaidAmount: data.newPaidAmount,
        newRemainingAmount: data.newRemainingAmount,
        status: data.status,
      });

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

  // POST /sales/:id/settle
  fastify.post<{ Params: { id: string } }>(
    "/:id/settle",
    {
      schema: settleSaleSchema,
      preHandler: requirePermission("sales:settle"),
    },
    async (request) => {
      const saleId = parseInt(request.params.id, 10);
      const body = request.body as {
        paymentMethod?: "cash" | "card" | "bank_transfer" | "credit";
        referenceNumber?: string;
        notes?: string;
        idempotencyKey?: string;
      };
      const userId = String(request.user?.sub ?? "system");
      const uc = new SettleSaleUseCase(
        fastify.db,
        fastify.repos.sale,
        fastify.repos.payment,
        fastify.repos.customer,
        fastify.repos.customerLedger,
        fastify.repos.accounting,
        fastify.repos.settings,
        fastify.repos.audit,
        fastify.repos.accountingSettings,
      );
      const result = await uc.execute({ saleId, ...body }, userId);

      fastify.emitDomainEvent("sale:settled", {
        id: saleId,
        settledAmount: result.settledAmount,
      });

      return {
        ok: true,
        data: {
          saleId: result.sale.id,
          settledAmount: result.settledAmount,
          newStatus: result.sale.status,
        },
      };
    },
  );
};

export default sales;
