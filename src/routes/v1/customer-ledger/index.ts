import { FastifyPluginAsync } from "fastify";
import {
  RecordCustomerPaymentUseCase,
  AddCustomerLedgerAdjustmentUseCase,
  ReconcileCustomerDebtUseCase,
} from "@nuqta/core";
import {
  ErrorResponses,
  successEnvelope,
  successPaginatedEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const CustomerLedgerEntrySchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    customerId: { type: "integer" },
    transactionType: {
      type: "string",
      enum: ["invoice", "payment", "return", "adjustment", "opening"],
    },
    amount: { type: "integer" },
    balanceAfter: { type: "integer" },
    saleId: { type: "integer", nullable: true },
    paymentId: { type: "integer", nullable: true },
    journalEntryId: { type: "integer", nullable: true },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const CustomerIdParamsSchema = {
  type: "object" as const,
  required: ["customerId"],
  properties: {
    customerId: {
      type: "string",
      pattern: "^\\d+$",
      description: "Customer ID",
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

const CustomerPaymentBodySchema = {
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

const CustomerAdjustmentBodySchema = {
  type: "object" as const,
  required: ["amount"],
  properties: {
    amount: {
      type: "number",
      description: "Adjustment amount (positive or negative)",
    },
    notes: { type: "string" },
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

export const getCustomerLedgerSchema = {
  tags: ["Customer Ledger"],
  summary: "Get customer ledger entries",
  security: [{ bearerAuth: [] }],
  params: CustomerIdParamsSchema,
  querystring: LedgerQuerySchema,
  response: {
    200: successPaginatedEnvelope(CustomerLedgerEntrySchema, "Customer ledger"),
    ...ErrorResponses,
  },
} as const;

const recordCustomerPaymentSchema = {
  tags: ["Customer Ledger"],
  summary: "Record a customer payment",
  security: [{ bearerAuth: [] }],
  params: CustomerIdParamsSchema,
  body: CustomerPaymentBodySchema,
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Payment recorded",
    ),
    ...ErrorResponses,
  },
} as const;

const addCustomerAdjustmentSchema = {
  tags: ["Customer Ledger"],
  summary: "Add customer ledger adjustment",
  security: [{ bearerAuth: [] }],
  params: CustomerIdParamsSchema,
  body: CustomerAdjustmentBodySchema,
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Adjustment recorded",
    ),
    ...ErrorResponses,
  },
} as const;

const reconcileCustomerDebtSchema = {
  tags: ["Customer Ledger"],
  summary: "Reconcile customer debt",
  description: "Check (or repair) customer debt totals against ledger sum.",
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

const customerLedger: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /customer-ledger/:customerId
  fastify.get<{ Params: { customerId: string } }>(
    "/:customerId",
    {
      schema: getCustomerLedgerSchema,
      preHandler: requirePermission("ledger:read"),
    },
    async (request) => {
      const customerId = parseInt(request.params.customerId, 10);
      const query = request.query as {
        dateFrom?: string;
        dateTo?: string;
        limit?: string;
        offset?: string;
      };
      const data = await fastify.repos.customerLedger.findAll({
        customerId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return { ok: true, data };
    },
  );

  // POST /customer-ledger/:customerId/payments
  fastify.post<{ Params: { customerId: string } }>(
    "/:customerId/payments",
    {
      schema: recordCustomerPaymentSchema,
      preHandler: requirePermission("ledger:payment"),
    },
    async (request) => {
      const customerId = parseInt(request.params.customerId, 10);
      const body = request.body as {
        amount: number;
        paymentMethod: string;
        notes?: string;
        idempotencyKey?: string;
      };
      const userId = request.user?.sub || 1;
      const uc = new RecordCustomerPaymentUseCase(
        fastify.repos.customerLedger,
        fastify.repos.customer,
        fastify.repos.payment,
        fastify.repos.accounting,
        fastify.repos.audit,
        fastify.repos.settings,
        fastify.repos.accountingSettings,
      );
      const data = await uc.execute({ customerId, ...body }, userId);
      return { ok: true, data };
    },
  );

  // POST /customer-ledger/:customerId/adjustments
  fastify.post<{ Params: { customerId: string } }>(
    "/:customerId/adjustments",
    {
      schema: addCustomerAdjustmentSchema,
      preHandler: requirePermission("ledger:adjust"),
    },
    async (request) => {
      const customerId = parseInt(request.params.customerId, 10);
      const body = request.body as { amount: number; notes?: string };
      const userId = request.user?.sub || 1;
      const uc = new AddCustomerLedgerAdjustmentUseCase(
        fastify.repos.customerLedger,
        fastify.repos.customer,
        fastify.repos.audit,
      );
      const data = await uc.execute({ customerId, ...body }, userId);
      return { ok: true, data };
    },
  );

  // POST /customer-ledger/reconcile
  fastify.post(
    "/reconcile",
    {
      schema: reconcileCustomerDebtSchema,
      preHandler: requirePermission("ledger:adjust"),
    },
    async (request) => {
      const { repair } = (request.query as { repair?: string }) || {};
      const uc = new ReconcileCustomerDebtUseCase(
        fastify.repos.customer,
        fastify.repos.customerLedger,
      );
      if (repair === "true") {
        const corrected = await uc.repair();
        return { ok: true, data: { corrected } };
      }
      const data = await uc.execute();
      return { ok: true, data };
    },
  );
};

export default customerLedger;
