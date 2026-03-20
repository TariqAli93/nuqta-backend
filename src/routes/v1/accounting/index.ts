import { FastifyPluginAsync } from "fastify";
import {
  InitializeAccountingUseCase,
  CreateAccountUseCase,
} from "../../../domain/index.js";
import {
  ReconcileJournalLinesUseCase,
  UnreconcileUseCase,
  GetReconciliationsUseCase,
  GetPartnerLedgerUseCase,
  GetUnreconciledLinesUseCase,
} from "../../../domain/use-cases/accounting/index.js";
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
  successPaginatedEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const AccountSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    code: { type: "string" },
    name: { type: "string" },
    nameAr: { type: "string", nullable: true },
    accountType: {
      type: "string",
      enum: ["asset", "liability", "equity", "revenue", "expense"],
    },
    parentId: { type: "integer", nullable: true },
    isSystem: { type: "boolean" },
    isActive: { type: "boolean" },
    balance: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
  },
};

const JournalLineSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    journalEntryId: { type: "integer" },
    accountId: { type: "integer" },
    debit: { type: "integer" },
    credit: { type: "integer" },
    description: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const JournalEntrySchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    entryNumber: { type: "string" },
    entryDate: { type: "string", format: "date-time" },
    description: { type: "string" },
    sourceType: {
      type: "string",
      nullable: true,
      enum: ["sale", "purchase", "payment", "adjustment", "manual"],
    },
    sourceId: { type: "integer", nullable: true },
    isPosted: { type: "boolean" },
    isReversed: { type: "boolean" },
    reversalOfId: { type: "integer", nullable: true },
    postingBatchId: { type: "integer", nullable: true },
    totalAmount: { type: "integer" },
    currency: { type: "string" },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
    lines: { type: "array", items: JournalLineSchema },
  },
};

const JournalEntriesQuerySchema = {
  type: "object" as const,
  properties: {
    sourceType: {
      type: "string",
      enum: ["sale", "purchase", "payment", "adjustment", "manual"],
    },
    dateFrom: { type: "string", format: "date" },
    dateTo: { type: "string", format: "date" },
    isPosted: { type: "string", enum: ["true", "false"] },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const DateRangeQuerySchema = {
  type: "object" as const,
  properties: {
    dateFrom: { type: "string", format: "date" },
    dateTo: { type: "string", format: "date" },
  },
} as const;

const BalanceSheetDateRangeSchema = {
  type: "object" as const,
  properties: {
    fromDate: { type: "string", format: "date" },
    toDate: { type: "string", format: "date" },
  },
} as const;

const TrialBalanceRowSchema = {
  type: "object" as const,
  properties: {
    accountId: { type: "integer" },
    accountCode: { type: "string" },
    accountName: { type: "string" },
    accountType: { type: "string" },
    debit: { type: "integer" },
    credit: { type: "integer" },
    balance: { type: "integer" },
  },
};

const getAccountsSchema = {
  tags: ["Accounting"],
  summary: "List chart of accounts",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(AccountSchema, "Chart of accounts"),
    ...ErrorResponses,
  },
} as const;

export const getJournalEntriesSchema = {
  tags: ["Accounting"],
  summary: "List journal entries",
  security: [{ bearerAuth: [] }],
  querystring: JournalEntriesQuerySchema,
  response: {
    200: successPaginatedEnvelope(JournalEntrySchema, "Journal entries"),
    ...ErrorResponses,
  },
} as const;

const getEntryByIdSchema = {
  tags: ["Accounting"],
  summary: "Get journal entry by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(JournalEntrySchema, "Journal entry details"),
    ...ErrorResponses,
  },
} as const;

const getTrialBalanceSchema = {
  tags: ["Accounting"],
  summary: "Get trial balance",
  security: [{ bearerAuth: [] }],
  querystring: DateRangeQuerySchema,
  response: {
    200: successArrayEnvelope(TrialBalanceRowSchema, "Trial balance"),
    ...ErrorResponses,
  },
} as const;

const getProfitLossSchema = {
  tags: ["Accounting"],
  summary: "Get profit & loss report",
  security: [{ bearerAuth: [] }],
  querystring: DateRangeQuerySchema,
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Profit & loss report",
    ),
    ...ErrorResponses,
  },
} as const;

const initializeAccountingSchema = {
  tags: ["Accounting"],
  summary: "Initialize accounting system",
  description: "Set up initial chart of accounts. Idempotent operation.",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object" as const,
    additionalProperties: true,
    description: "Optional initialization parameters",
  },
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Initialization result",
    ),
    ...ErrorResponses,
  },
} as const;

const getAccountingStatusSchema = {
  tags: ["Accounting"],
  summary: "Get accounting system status",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          isInitialized: { type: "boolean" },
          accountCount: { type: "integer" },
        },
      },
      "Accounting status",
    ),
    ...ErrorResponses,
  },
} as const;

const accounting: FastifyPluginAsync = async (fastify) => {
  // fastify.addHook("onRequest", fastify.authenticate);

  // GET /accounting/accounts
  fastify.get(
    "/accounts",
    {
      schema: getAccountsSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const data = await fastify.repos.accounting.getAccounts();
      return { ok: true, data };
    },
  );

  // POST /accounting/accounts
  fastify.post(
    "/accounts",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Create a new account",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object" as const,
          required: ["code", "name", "nameAr", "accountType"],
          properties: {
            code: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1 },
            nameAr: { type: "string" },
            accountType: {
              type: "string",
              enum: ["asset", "liability", "equity", "revenue", "expense"],
            },
            parentId: { type: "integer", nullable: true },
          },
          additionalProperties: false,
        },
        response: {
          200: successEnvelope(AccountSchema, "Created account"),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:write")],
    },
    async (request) => {
      const body = request.body as {
        code: string;
        name: string;
        nameAr: string;
        accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
        parentId?: number | null;
      };
      const uc = new CreateAccountUseCase(
        fastify.repos.accounting,
        fastify.repos.audit,
      );
      const data = await uc.execute(body, String(request.user?.sub ?? "0"));
      return { ok: true, data };
    },
  );

  // PUT /accounting/accounts/:id
  fastify.put<{ Params: { id: string } }>(
    "/accounts/:id",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Update chart of accounts entry",
        security: [{ bearerAuth: [] }],
        params: { $ref: "IdParams#" },
        body: {
          type: "object" as const,
          properties: {
            name: { type: "string", minLength: 1 },
            nameAr: { type: "string", nullable: true },
            accountType: {
              type: "string",
              enum: ["asset", "liability", "equity", "revenue", "expense"],
            },
            parentId: { type: "integer", nullable: true },
            isActive: { type: "boolean" },
          },
          additionalProperties: false,
        },
        response: {
          200: successEnvelope(AccountSchema, "Updated account"),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:write")],
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const body = request.body as Partial<{
        name: string;
        nameAr: string | null;
        accountType: string;
        parentId: number | null;
        isActive: boolean;
      }>;
      const { accounts } = await import("../../../data/schema/schema.js");
      const { eq } = await import("drizzle-orm");
      const [updated] = await fastify.db
        .update(accounts)
        .set({ ...body })
        .where(eq(accounts.id, id))
        .returning();
      if (!updated) {
        return (
          (request as any).server.httpErrors?.notFound?.() ?? {
            ok: false,
            error: { code: "NOT_FOUND", message: "Account not found" },
          }
        );
      }
      return { ok: true, data: updated };
    },
  );

  // GET /accounting/journal-entries
  fastify.get(
    "/journal-entries",
    {
      schema: getJournalEntriesSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const query = request.query as {
        sourceType?: string;
        dateFrom?: string;
        dateTo?: string;
        isPosted?: string;
        limit?: string;
        offset?: string;
      };
      const data = await fastify.repos.accounting.getJournalEntries({
        sourceType: query.sourceType,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        isPosted:
          query.isPosted !== undefined ? query.isPosted === "true" : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return { ok: true, data };
    },
  );

  // POST /accounting/journal-entries
  fastify.post(
    "/journal-entries",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Create a manual journal entry",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object" as const,
          required: ["entryDate", "description", "lines"],
          properties: {
            entryDate: { type: "string", format: "date" },
            description: { type: "string", minLength: 1 },
            notes: { type: "string", nullable: true },
            currency: { type: "string" },
            lines: {
              type: "array",
              minItems: 2,
              items: {
                type: "object" as const,
                required: ["accountId"],
                properties: {
                  accountId: { type: "integer", minimum: 1 },
                  partnerId: { type: "integer", nullable: true },
                  debit: { type: "integer", minimum: 0 },
                  credit: { type: "integer", minimum: 0 },
                  description: { type: "string", nullable: true },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
        response: {
          200: successEnvelope(JournalEntrySchema, "Created journal entry"),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:write")],
    },
    async (request) => {
      const body = request.body as {
        entryDate: string;
        description: string;
        notes?: string;
        currency?: string;
        lines: {
          accountId: number;
          partnerId?: number | null;
          debit?: number;
          credit?: number;
          description?: string | null;
        }[];
      };
      const totalAmount = body.lines.reduce(
        (sum, l) => sum + (l.debit ?? 0),
        0,
      );
      const entry = await fastify.repos.accounting.createJournalEntry({
        entryNumber: "",
        entryDate: body.entryDate,
        description: body.description,
        notes: body.notes ?? null,
        currency: body.currency ?? "IQD",
        sourceType: "manual",
        isPosted: false,
        isReversed: false,
        totalAmount,
        lines: body.lines.map((l) => ({
          accountId: l.accountId,
          partnerId: l.partnerId ?? null,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          balance: (l.debit ?? 0) - (l.credit ?? 0),
          description: l.description ?? null,
          reconciled: false,
        })),
      });
      return { ok: true, data: entry };
    },
  );

  // GET /accounting/journal-entries/:id
  fastify.get<{ Params: { id: string } }>(
    "/journal-entries/:id",
    {
      schema: getEntryByIdSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const data = await fastify.repos.accounting.getEntryById(id);
      return { ok: true, data };
    },
  );

  // GET /accounting/trial-balance
  fastify.get(
    "/trial-balance",
    {
      schema: getTrialBalanceSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const query = request.query as { dateFrom?: string; dateTo?: string };
      const data = await fastify.repos.accounting.getTrialBalance({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/profit-loss
  fastify.get(
    "/profit-loss",
    {
      schema: getProfitLossSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const query = request.query as { dateFrom?: string; dateTo?: string };
      const data = await fastify.repos.accounting.getProfitLoss({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/balance-sheet
  fastify.get(
    "/balance-sheet",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Get balance sheet",
        security: [{ bearerAuth: [] }],
        querystring: BalanceSheetDateRangeSchema,
        response: {
          200: successEnvelope(
            { type: "object" as const, additionalProperties: true },
            "Balance sheet",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const query = request.query as { fromDate?: string; toDate?: string };
      const data = await fastify.repos.accounting.getBalanceSheet(query || {});
      return { ok: true, data };
    },
  );

  // POST /accounting/initialize
  fastify.post(
    "/initialize",
    {
      schema: initializeAccountingSchema,
      preHandler: [],
    },
    async (request) => {
      const body = request.body as any;
      const uc = new InitializeAccountingUseCase(
        fastify.repos.settings,
        fastify.repos.accounting,
      );
      const data = await uc.execute(
        body || {},
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );

  // GET /accounting/status
  fastify.get(
    "/status",
    {
      schema: getAccountingStatusSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const uc = new InitializeAccountingUseCase(
        fastify.repos.settings,
        fastify.repos.accounting,
      );
      const data = await uc.getStatus();
      return { ok: true, data };
    },
  );

  // ══════════════════════════════════════════════════════════════════════
  // RECONCILIATION ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════

  // POST /accounting/reconcile
  fastify.post(
    "/reconcile",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Reconcile journal lines (AR/AP matching)",
        description:
          "Match debit lines (invoices) with credit lines (payments) on the same AR or AP account for the same partner. " +
          "Supports full, partial, and overpayment scenarios.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object" as const,
          required: ["journalLineIds"],
          properties: {
            journalLineIds: {
              type: "array",
              items: { type: "integer" },
              minItems: 2,
              description: "IDs of journal lines to reconcile",
            },
            amounts: {
              type: "array",
              items: { type: "integer", minimum: 1 },
              description:
                "Optional partial amounts per line (index-matched to journalLineIds). Omit for full-balance matching.",
            },
            notes: { type: "string" },
          },
          additionalProperties: false,
        },
        response: {
          200: successEnvelope(
            { type: "object" as const, additionalProperties: true },
            "Reconciliation created",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:write")],
    },
    async (request) => {
      const body = request.body as {
        journalLineIds: number[];
        amounts?: number[];
        notes?: string;
      };
      const uc = new ReconcileJournalLinesUseCase(
        fastify.repos.reconciliation,
        fastify.repos.audit,
      );
      const data = await uc.execute(body, String(request.user?.sub ?? "0"));
      return { ok: true, data };
    },
  );

  // POST /accounting/unreconcile
  fastify.post(
    "/unreconcile",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Reverse (unreconcile) a reconciliation",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object" as const,
          required: ["reconciliationId"],
          properties: {
            reconciliationId: { type: "integer" },
          },
          additionalProperties: false,
        },
        response: {
          200: successEnvelope(
            { type: "object" as const, additionalProperties: true },
            "Reconciliation reversed",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:write")],
    },
    async (request) => {
      const { reconciliationId } = request.body as { reconciliationId: number };
      const uc = new UnreconcileUseCase(
        fastify.repos.reconciliation,
        fastify.repos.audit,
      );
      const data = await uc.execute(
        { reconciliationId },
        String(request.user?.sub ?? "0"),
      );
      return { ok: true, data };
    },
  );

  // GET /accounting/reconciliations
  fastify.get(
    "/reconciliations",
    {
      schema: {
        tags: ["Accounting"],
        summary: "List reconciliations",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object" as const,
          properties: {
            type: {
              type: "string",
              enum: ["customer", "supplier", "account"],
            },
            status: {
              type: "string",
              enum: ["open", "partially_paid", "paid"],
            },
            limit: { type: "string", pattern: "^\\d+$" },
            offset: { type: "string", pattern: "^\\d+$" },
          },
        },
        response: {
          200: successPaginatedEnvelope(
            { type: "object" as const, additionalProperties: true },
            "Reconciliations",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const q = request.query as {
        type?: string;
        status?: string;
        limit?: string;
        offset?: string;
      };
      const uc = new GetReconciliationsUseCase(fastify.repos.reconciliation);
      const data = await uc.execute({
        type: q.type,
        status: q.status,
        limit: q.limit ? parseInt(q.limit, 10) : undefined,
        offset: q.offset ? parseInt(q.offset, 10) : undefined,
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/unreconciled-lines
  fastify.get(
    "/unreconciled-lines",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Get unreconciled AR/AP journal lines",
        description:
          "Returns candidate journal lines for reconciliation. " +
          "Filter by accountCode (required) and optionally partnerId.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object" as const,
          properties: {
            accountCode: {
              type: "string",
              description: "e.g. 1100 (AR) or 2100 (AP)",
            },
            partnerId: { type: "string", pattern: "^\\d+$" },
          },
        },
        response: {
          200: successArrayEnvelope(
            { type: "object" as const, additionalProperties: true },
            "Unreconciled journal lines",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const q = request.query as {
        accountCode?: string;
        partnerId?: string;
      };
      const uc = new GetUnreconciledLinesUseCase(fastify.repos.reconciliation);
      const data = await uc.execute({
        accountCode: q.accountCode,
        partnerId: q.partnerId ? parseInt(q.partnerId, 10) : undefined,
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/customers/:id/ledger
  fastify.get<{ Params: { id: string } }>(
    "/customers/:id/ledger",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Customer AR ledger (journal-line based)",
        description:
          "Returns the full AR ledger for a customer, read directly from journal lines. " +
          "Includes reconciliation status per line and running balance.",
        security: [{ bearerAuth: [] }],
        params: { $ref: "IdParams#" },
        response: {
          200: successEnvelope(
            { type: "object" as const, additionalProperties: true },
            "Customer AR ledger",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const customerId = parseInt(request.params.id, 10);
      const uc = new GetPartnerLedgerUseCase(fastify.repos.reconciliation);
      const data = await uc.execute({
        partnerId: customerId,
        partnerType: "customer",
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/suppliers/:id/ledger
  fastify.get<{ Params: { id: string } }>(
    "/suppliers/:id/ledger",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Supplier AP ledger (journal-line based)",
        description:
          "Returns the full AP ledger for a supplier, read directly from journal lines. " +
          "Includes reconciliation status per line and running balance.",
        security: [{ bearerAuth: [] }],
        params: { $ref: "IdParams#" },
        response: {
          200: successEnvelope(
            { type: "object" as const, additionalProperties: true },
            "Supplier AP ledger",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const supplierId = parseInt(request.params.id, 10);
      const uc = new GetPartnerLedgerUseCase(fastify.repos.reconciliation);
      const data = await uc.execute({
        partnerId: supplierId,
        partnerType: "supplier",
      });
      return { ok: true, data };
    },
  );
};

export default accounting;
