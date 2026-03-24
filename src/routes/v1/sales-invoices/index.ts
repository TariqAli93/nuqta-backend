import { FastifyPluginAsync } from "fastify";
import {
  CreateSaleUseCase,
  AddPaymentUseCase,
  NotFoundError,
  ValidationError,
  InvalidStateError,
  type CreateSaleInput,
  type AddPaymentInput,
} from "../../../domain/index.js";
import { FifoService } from "../../../data/index.js";
import {
  ErrorResponses,
  successEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const SalesInvoiceItemSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    saleId: { type: "integer" },
    productId: { type: "integer" },
    productName: { type: "string" },
    quantity: { type: "integer" },
    unitPrice: { type: "integer" },
    discount: { type: "integer" },
    subtotal: { type: "integer" },
  },
};

const SalesInvoiceSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    invoiceNumber: { type: "string" },
    customerId: { type: "integer", nullable: true },
    subtotal: { type: "integer" },
    discount: { type: "integer" },
    tax: { type: "integer" },
    total: { type: "integer" },
    paidAmount: { type: "integer" },
    remainingAmount: { type: "integer" },
    paymentStatus: {
      type: "string",
      enum: ["unpaid", "partially_paid", "paid"],
    },
    paymentModeAtCreation: {
      type: "string",
      enum: ["cash", "credit", "partial"],
    },
    currency: { type: "string" },
    status: { type: "string" },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    items: { type: "array", items: SalesInvoiceItemSchema },
  },
};

const CreateSalesInvoiceBodySchema = {
  type: "object" as const,
  required: ["items", "paymentType"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
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
      },
    },
    customerId: { type: "integer" },
    discount: { type: "integer", minimum: 0 },
    tax: { type: "integer", minimum: 0 },
    paymentType: { type: "string", enum: ["cash", "credit", "mixed"] },
    paidAmount: { type: "integer", minimum: 0 },
    currency: { type: "string" },
    notes: { type: "string" },
    paymentMethod: {
      type: "string",
      enum: ["cash", "card", "bank_transfer", "credit"],
    },
    referenceNumber: { type: "string" },
    idempotencyKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

const CollectPaymentBodySchema = {
  type: "object" as const,
  required: ["amount", "paymentMethod"],
  properties: {
    amount: { type: "integer", minimum: 1 },
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

const createSalesInvoiceSchema = {
  tags: ["Sales Invoices"],
  summary: "Create a sales invoice (AR)",
  description:
    "Create a new sales invoice. paymentType determines the initial payment mode: cash (fully paid), credit (unpaid), mixed (partially paid).",
  security: [{ bearerAuth: [] }],
  body: CreateSalesInvoiceBodySchema,
  response: {
    200: successEnvelope(SalesInvoiceSchema, "Created sales invoice"),
    ...ErrorResponses,
  },
} as const;

const getSalesInvoiceByIdSchema = {
  tags: ["Sales Invoices"],
  summary: "Get a sales invoice by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(SalesInvoiceSchema, "Sales invoice details"),
    ...ErrorResponses,
  },
} as const;

const collectPaymentSchema = {
  tags: ["Sales Invoices"],
  summary: "Collect payment on a sales invoice (AR)",
  description:
    "Record a payment against a sales invoice. Amount must be > 0 and <= remainingAmount. Overpayment is forbidden.",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: CollectPaymentBodySchema,
  response: {
    200: successEnvelope(SalesInvoiceSchema, "Updated sales invoice"),
    ...ErrorResponses,
  },
} as const;

const salesInvoices: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /sales-invoices
  fastify.post(
    "/",
    {
      schema: createSalesInvoiceSchema,
      preHandler: requirePermission("sales:create"),
    },
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
      return { ok: true, data: createdSale };
    },
  );

  // GET /sales-invoices/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: getSalesInvoiceByIdSchema,
      preHandler: requirePermission("sales:read"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const data = await fastify.repos.sale.findById(id);
      if (!data) {
        throw new NotFoundError("Sales invoice not found", { id });
      }
      return { ok: true, data };
    },
  );

  // POST /sales-invoices/:id/collect-payment
  fastify.post<{ Params: { id: string } }>(
    "/:id/collect-payment",
    {
      schema: collectPaymentSchema,
      preHandler: requirePermission("sales:payment"),
    },
    async (request) => {
      const saleId = parseInt(request.params.id, 10);
      const body = request.body as {
        amount: number;
        paymentMethod: "cash" | "card" | "bank_transfer" | "credit";
        referenceNumber?: string;
        notes?: string;
        idempotencyKey?: string;
      };
      const userId = String(request.user?.sub ?? "system");

      // Validate before delegating to use case
      if (!Number.isInteger(body.amount) || body.amount <= 0) {
        throw new ValidationError("Payment amount must be a positive integer", {
          amount: body.amount,
        });
      }

      const sale = await fastify.repos.sale.findById(saleId);
      if (!sale) {
        throw new NotFoundError("Sales invoice not found", { id: saleId });
      }

      if ((sale.remainingAmount ?? 0) <= 0) {
        throw new InvalidStateError(
          "This invoice is already fully paid (paymentStatus=paid)",
          { saleId, paymentStatus: sale.paymentStatus },
        );
      }

      if (body.amount > (sale.remainingAmount ?? 0)) {
        throw new ValidationError(
          "Payment amount exceeds remaining balance — overpayment is forbidden",
          {
            amount: body.amount,
            remainingAmount: sale.remainingAmount,
          },
        );
      }

      const input: AddPaymentInput = {
        saleId,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        referenceNumber: body.referenceNumber,
        notes: body.notes,
        idempotencyKey: body.idempotencyKey,
      };

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
        fastify.repos.salesInvoicePayment,
      );

      const result = await uc.execute(input, userId);
      return { ok: true, data: result };
    },
  );
};

export default salesInvoices;
