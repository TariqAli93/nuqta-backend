import { FastifyPluginAsync } from "fastify";
import {
  RecordSupplierPaymentUseCase,
  ReconcileSupplierBalanceUseCase,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  successPaginatedEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const SupplierLedgerEntrySchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    supplierId: { type: "integer" },
    transactionType: {
      type: "string",
      enum: ["purchase", "payment", "opening_balance", "adjustment", "cancellation", "refund", "payment_reversal"],
    },
    amount: { type: "integer" },
    balanceAfter: { type: "integer" },
    purchaseId: { type: "integer", nullable: true },
    paymentId: { type: "integer", nullable: true },
    journalEntryId: { type: "integer", nullable: true },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const SupplierIdParamsSchema = {
  type: "object" as const,
  required: ["supplierId"],
  properties: {
    supplierId: {
      type: "string",
      pattern: "^\\d+$",
      description: "Supplier ID",
    },
  },
} as const;

const LedgerQuerySchema = {
  type: "object" as const,
  properties: {
    dateFrom: { type: "string", format: "date" },
    dateTo: { type: "string", format: "date" },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const SupplierPaymentBodySchema = {
  type: "object" as const,
  required: ["amount", "paymentMethod"],
  properties: {
    amount: { type: "number", minimum: 0.01, description: "Payment amount" },
    paymentMethod: {
      type: "string",
      enum: ["cash", "card", "bank_transfer", "credit"],
    },
    notes: { type: "string" },
    idempotencyKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

const ReconcileQuerySchema = {
  type: "object" as const,
  properties: {
    repair: {
      type: "string",
      enum: ["true", "false"],
      description: "If true, auto-correct discrepancies",
    },
  },
} as const;

export const getSupplierLedgerSchema = {
  tags: ["Supplier Ledger"],
  summary: "Get supplier ledger entries",
  security: [{ bearerAuth: [] }],
  params: SupplierIdParamsSchema,
  querystring: LedgerQuerySchema,
  response: {
    200: successPaginatedEnvelope(SupplierLedgerEntrySchema, "Supplier ledger"),
    ...ErrorResponses,
  },
} as const;

const recordSupplierPaymentSchema = {
  tags: ["Supplier Ledger"],
  summary: "Record a supplier payment",
  security: [{ bearerAuth: [] }],
  params: SupplierIdParamsSchema,
  body: SupplierPaymentBodySchema,
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Payment recorded",
    ),
    ...ErrorResponses,
  },
} as const;

const reconcileSupplierBalanceSchema = {
  tags: ["Supplier Ledger"],
  summary: "Reconcile supplier balance",
  description: "Check (or repair) supplier balance totals against ledger sum.",
  security: [{ bearerAuth: [] }],
  querystring: ReconcileQuerySchema,
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Reconciliation result",
    ),
    ...ErrorResponses,
  },
} as const;

const supplierLedger: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /supplier-ledger/:supplierId
  fastify.get<{ Params: { supplierId: string } }>(
    "/:supplierId",
    {
      schema: getSupplierLedgerSchema,
      preHandler: requirePermission("ledger:read"),
    },
    async (request) => {
      const supplierId = parseInt(request.params.supplierId, 10);
      const query = request.query as {
        dateFrom?: string;
        dateTo?: string;
        limit?: string;
        offset?: string;
      };
      const data = await fastify.repos.supplierLedger.findAll({
        supplierId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return { ok: true, data };
    },
  );

  // POST /supplier-ledger/:supplierId/payments
  fastify.post<{ Params: { supplierId: string } }>(
    "/:supplierId/payments",
    {
      schema: recordSupplierPaymentSchema,
      preHandler: requirePermission("ledger:payment"),
    },
    async (request) => {
      const supplierId = parseInt(request.params.supplierId, 10);
      const body = request.body as {
        amount: number;
        paymentMethod: string;
        notes?: string;
        idempotencyKey?: string;
      };
      const userId = String(request.user?.sub ?? "system");
      const uc = new RecordSupplierPaymentUseCase(
        fastify.repos.supplierLedger,
        fastify.repos.supplier,
        fastify.repos.payment,
        fastify.repos.accounting,
        fastify.repos.audit,
        fastify.repos.settings,
        fastify.repos.accountingSettings,
        fastify.db,
      );
      const data = await uc.execute({ supplierId, ...body }, userId);
      return { ok: true, data };
    },
  );

  // POST /supplier-ledger/reconcile
  fastify.post(
    "/reconcile",
    {
      schema: reconcileSupplierBalanceSchema,
      preHandler: requirePermission("ledger:adjust"),
    },
    async (request) => {
      const { repair: repairQuery } = (request.query as { repair?: string }) || {};
      const bodyRepair = (request.body as { repair?: boolean } | null)?.repair;
      const repair = repairQuery === "true" || bodyRepair === true;
      const uc = new ReconcileSupplierBalanceUseCase(
        fastify.repos.supplier,
        fastify.repos.supplierLedger,
      );
      if (repair) {
        const corrected = await uc.repair();
        return { ok: true, data: { corrected } };
      }
      const data = await uc.execute(
        undefined as void,
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );
};

export default supplierLedger;
