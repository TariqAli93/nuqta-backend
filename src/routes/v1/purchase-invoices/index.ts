import { FastifyPluginAsync } from "fastify";
import {
  CreatePurchaseUseCase,
  AddPurchasePaymentUseCase,
  NotFoundError,
  ValidationError,
  InvalidStateError,
  type CreatePurchaseInput,
  type AddPurchasePaymentInput,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  successPaginatedEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const PurchaseInvoiceItemSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    purchaseId: { type: "integer" },
    productId: { type: "integer" },
    productName: { type: "string" },
    unitName: { type: "string" },
    unitFactor: { type: "integer" },
    quantity: { type: "integer" },
    quantityBase: { type: "integer" },
    unitCost: { type: "integer" },
    lineSubtotal: { type: "integer" },
    discount: { type: "integer" },
  },
};

const PurchaseInvoiceSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    invoiceNumber: { type: "string" },
    supplierId: { type: "integer" },
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
    items: { type: "array", items: PurchaseInvoiceItemSchema },
    payments: { type: "array", items: { type: "object" } },
  },
};

const CreatePurchaseInvoiceBodySchema = {
  type: "object" as const,
  required: ["invoiceNumber", "supplierId", "items"],
  properties: {
    invoiceNumber: { type: "string", minLength: 1 },
    supplierId: { type: "integer", minimum: 1 },
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["productId", "quantity", "unitCost"],
        properties: {
          productId: { type: "integer", minimum: 1 },
          productName: { type: "string" },
          unitName: { type: "string" },
          unitFactor: { type: "integer", minimum: 1 },
          quantity: { type: "integer", minimum: 1 },
          quantityBase: { type: "integer", minimum: 1 },
          unitCost: { type: "integer", minimum: 0 },
          lineSubtotal: { type: "integer", minimum: 0 },
          discount: { type: "integer", minimum: 0 },
          batchNumber: { type: "string" },
          expiryDate: { type: "string", format: "date-time" },
        },
      },
    },
    discount: { type: "integer", minimum: 0 },
    tax: { type: "integer", minimum: 0 },
    /** Initial payment. 0 = credit (AP), full = cash, partial = partial. */
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

const PayPurchaseBodySchema = {
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

const createPurchaseInvoiceSchema = {
  tags: ["Purchase Invoices"],
  summary: "Create a purchase invoice (AP)",
  description:
    "Create a new purchase invoice. paidAmount determines the initial mode: 0 = credit (fully unpaid), equal to total = cash (fully paid), partial otherwise.",
  security: [{ bearerAuth: [] }],
  body: CreatePurchaseInvoiceBodySchema,
  response: {
    200: successEnvelope(PurchaseInvoiceSchema, "Created purchase invoice"),
    ...ErrorResponses,
  },
} as const;

const getPurchaseInvoiceByIdSchema = {
  tags: ["Purchase Invoices"],
  summary: "Get a purchase invoice by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(PurchaseInvoiceSchema, "Purchase invoice details"),
    ...ErrorResponses,
  },
} as const;

const payPurchaseInvoiceSchema = {
  tags: ["Purchase Invoices"],
  summary: "Pay a purchase invoice (AP)",
  description:
    "Record a payment against a purchase invoice. Amount must be > 0 and <= remainingAmount. Overpayment is forbidden.",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: PayPurchaseBodySchema,
  response: {
    200: successEnvelope(PurchaseInvoiceSchema, "Updated purchase invoice"),
    ...ErrorResponses,
  },
} as const;

const purchaseInvoices: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /purchase-invoices
  fastify.post(
    "/",
    {
      schema: createPurchaseInvoiceSchema,
      preHandler: requirePermission("purchases:create"),
    },
    async (request) => {
      const body = request.body as CreatePurchaseInput;
      const userId = String(request.user?.sub ?? "system");
      const uc = new CreatePurchaseUseCase(
        fastify.db,
        fastify.repos.purchase,
        fastify.repos.supplier,
        fastify.repos.payment,
        fastify.repos.supplierLedger,
        fastify.repos.accounting,
        fastify.repos.settings,
        fastify.repos.audit,
        fastify.repos.accountingSettings,
      );
      const result = await uc.execute(body, userId);
      return { ok: true, data: result };
    },
  );

  // GET /purchase-invoices/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: getPurchaseInvoiceByIdSchema,
      preHandler: requirePermission("purchases:read"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const data = await fastify.repos.purchase.findById(id);
      if (!data) {
        throw new NotFoundError("Purchase invoice not found", { id });
      }
      return { ok: true, data };
    },
  );

  // POST /purchase-invoices/:id/pay
  fastify.post<{ Params: { id: string } }>(
    "/:id/pay",
    {
      schema: payPurchaseInvoiceSchema,
      preHandler: requirePermission("purchases:create"),
    },
    async (request) => {
      const purchaseId = parseInt(request.params.id, 10);
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

      const purchase = await fastify.repos.purchase.findById(purchaseId);
      if (!purchase) {
        throw new NotFoundError("Purchase invoice not found", {
          id: purchaseId,
        });
      }

      if ((purchase.remainingAmount ?? 0) <= 0) {
        throw new InvalidStateError(
          "This invoice is already fully paid (paymentStatus=paid)",
          { purchaseId, paymentStatus: purchase.paymentStatus },
        );
      }

      if (body.amount > (purchase.remainingAmount ?? 0)) {
        throw new ValidationError(
          "Payment amount exceeds remaining balance — overpayment is forbidden",
          {
            amount: body.amount,
            remainingAmount: purchase.remainingAmount,
          },
        );
      }

      const input: AddPurchasePaymentInput = {
        purchaseId,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        referenceNumber: body.referenceNumber,
        notes: body.notes,
        idempotencyKey: body.idempotencyKey,
      };

      const uc = new AddPurchasePaymentUseCase(
        fastify.db,
        fastify.repos.purchase,
        fastify.repos.payment,
        fastify.repos.supplierLedger,
        fastify.repos.accounting,
        fastify.repos.settings,
        fastify.repos.audit,
        fastify.repos.accountingSettings,
        fastify.repos.purchaseInvoicePayment,
      );

      const result = await uc.execute(input, userId);
      return { ok: true, data: result };
    },
  );
};

export default purchaseInvoices;
