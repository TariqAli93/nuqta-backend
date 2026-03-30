import { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const FiscalYearSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    status: { type: "string", enum: ["OPEN", "CLOSED"] },
    notes: { type: "string", nullable: true },
    closedAt: { type: "string", nullable: true },
    closedById: { type: "integer", nullable: true },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const fiscalYearsPlugin: FastifyPluginAsync = async (fastify) => {
  // GET /fiscal-years
  fastify.get(
    "/",
    {
      schema: {
        tags: ["FiscalYears"],
        summary: "List all fiscal years",
        security: [{ bearerAuth: [] }],
        response: {
          200: successArrayEnvelope(FiscalYearSchema, "Fiscal years"),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async () => {
      const data = await fastify.repos.fiscalYear.findAll();
      return { ok: true, data };
    },
  );

  // GET /fiscal-years/active
  fastify.get(
    "/active",
    {
      schema: {
        tags: ["FiscalYears"],
        summary: "Get the currently open fiscal year",
        security: [{ bearerAuth: [] }],
        response: {
          200: successEnvelope(
            { type: "object" as const, additionalProperties: true, nullable: true },
            "Active fiscal year",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async () => {
      const data = await fastify.repos.fiscalYear.findActive();
      return { ok: true, data };
    },
  );

  // GET /fiscal-years/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {
        tags: ["FiscalYears"],
        summary: "Get a fiscal year by ID",
        security: [{ bearerAuth: [] }],
        params: { $ref: "IdParams#" },
        response: {
          200: successEnvelope(FiscalYearSchema, "Fiscal year"),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const data = await fastify.repos.fiscalYear.findById(id);
      if (!data) throw fastify.httpErrors.notFound("السنة الحسابية غير موجودة");
      return { ok: true, data };
    },
  );

  // POST /fiscal-years — open a new fiscal year
  fastify.post(
    "/",
    {
      schema: {
        tags: ["FiscalYears"],
        summary: "Open a new fiscal year",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object" as const,
          required: ["name", "startDate", "endDate"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            notes: { type: "string", maxLength: 500 },
          },
          additionalProperties: false,
        },
        response: {
          201: successEnvelope(FiscalYearSchema, "Created fiscal year"),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:write")],
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        startDate: string;
        endDate: string;
        notes?: string;
      };

      if (body.startDate >= body.endDate) {
        throw fastify.httpErrors.badRequest(
          "تاريخ البداية يجب أن يكون قبل تاريخ النهاية",
        );
      }

      const active = await fastify.repos.fiscalYear.findActive();
      if (active) {
        throw fastify.httpErrors.conflict(
          `توجد سنة حسابية مفتوحة (${active.name}). أغلقها أولاً قبل فتح سنة جديدة.`,
        );
      }

      const overlap = await fastify.repos.fiscalYear.hasOverlap(
        body.startDate,
        body.endDate,
      );
      if (overlap) {
        throw fastify.httpErrors.conflict(
          "التواريخ المحددة تتداخل مع سنة حسابية موجودة.",
        );
      }

      const data = await fastify.repos.fiscalYear.create({
        name: body.name,
        startDate: body.startDate,
        endDate: body.endDate,
        status: "OPEN",
        notes: body.notes ?? null,
      });

      return reply.code(201).send({ ok: true, data });
    },
  );

  // POST /fiscal-years/:id/close
  fastify.post<{ Params: { id: string } }>(
    "/:id/close",
    {
      schema: {
        tags: ["FiscalYears"],
        summary: "Close a fiscal year and generate closing journal entries",
        security: [{ bearerAuth: [] }],
        params: { $ref: "IdParams#" },
        body: {
          type: "object" as const,
          required: ["retainedEarningsAccountId"],
          properties: {
            retainedEarningsAccountId: { type: "integer", minimum: 1 },
          },
          additionalProperties: false,
        },
        response: {
          200: successEnvelope(FiscalYearSchema, "Closed fiscal year"),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:write")],
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const userId = Number(request.user?.sub ?? 0);
      const { retainedEarningsAccountId } = request.body as {
        retainedEarningsAccountId: number;
      };

      const year = await fastify.repos.fiscalYear.findById(id);
      if (!year) throw fastify.httpErrors.notFound("السنة الحسابية غير موجودة");
      if (year.status === "CLOSED") {
        throw fastify.httpErrors.conflict("هذه السنة الحسابية مغلقة مسبقاً.");
      }

      const startStr = year.startDate;
      const endStr = year.endDate;

      // Query revenue and expense account balances for this fiscal year
      const balancesResult = await fastify.db.execute(sql`
        SELECT
          a.id AS "accountId",
          a.account_type AS "accountType",
          a.name AS "accountName",
          COALESCE(SUM(jl.debit), 0) AS "totalDebit",
          COALESCE(SUM(jl.credit), 0) AS "totalCredit"
        FROM accounts a
        INNER JOIN journal_lines jl ON jl.account_id = a.id
        INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE je.is_posted = true
          AND COALESCE(je.is_reversed, false) = false
          AND je.entry_date >= ${startStr}
          AND je.entry_date <= ${endStr}
          AND a.account_type IN ('revenue', 'expense')
          AND (je.notes IS NULL OR je.notes NOT LIKE 'CLOSING_ENTRY:%')
        GROUP BY a.id, a.account_type, a.name
      `);

      const balances = (balancesResult.rows ?? []) as {
        accountId: number;
        accountType: string;
        accountName: string;
        totalDebit: string;
        totalCredit: string;
      }[];

      const revenueAccounts = balances.filter((b) => b.accountType === "revenue");
      const expenseAccounts = balances.filter((b) => b.accountType === "expense");

      const totalRevenue = revenueAccounts.reduce(
        (sum, a) => sum + (Number(a.totalCredit) - Number(a.totalDebit)),
        0,
      );
      const totalExpenses = expenseAccounts.reduce(
        (sum, a) => sum + (Number(a.totalDebit) - Number(a.totalCredit)),
        0,
      );
      const netIncome = totalRevenue - totalExpenses;

      await fastify.db.transaction(async (tx) => {
        if (balances.length > 0) {
          const lines: {
            accountId: number;
            debit: number;
            credit: number;
            description: string;
          }[] = [];

          // Close revenue accounts (DR Revenue)
          for (const acc of revenueAccounts) {
            const balance = Number(acc.totalCredit) - Number(acc.totalDebit);
            if (balance <= 0) continue;
            lines.push({
              accountId: acc.accountId,
              debit: Math.round(balance),
              credit: 0,
              description: `إقفال ${acc.accountName}`,
            });
          }

          // Close expense accounts (CR Expenses)
          for (const acc of expenseAccounts) {
            const balance = Number(acc.totalDebit) - Number(acc.totalCredit);
            if (balance <= 0) continue;
            lines.push({
              accountId: acc.accountId,
              debit: 0,
              credit: Math.round(balance),
              description: `إقفال ${acc.accountName}`,
            });
          }

          // Transfer net income/loss to retained earnings
          if (netIncome > 0) {
            lines.push({
              accountId: retainedEarningsAccountId,
              debit: 0,
              credit: Math.round(netIncome),
              description: `صافي ربح السنة ${year.name}`,
            });
          } else if (netIncome < 0) {
            lines.push({
              accountId: retainedEarningsAccountId,
              debit: Math.round(Math.abs(netIncome)),
              credit: 0,
              description: `صافي خسارة السنة ${year.name}`,
            });
          }

          if (lines.length > 0) {
            await fastify.repos.accounting.createJournalEntry(
              {
                entryDate: endStr,
                description: `قيد إقفال السنة الحسابية: ${year.name}`,
                sourceType: "adjustment" as any,
                notes: `CLOSING_ENTRY:fiscal_year_id:${year.id}`,
                isPosted: true,
                isReversed: false,
                totalAmount: lines.reduce((s, l) => s + l.debit + l.credit, 0) / 2,
                currency: "IQD",
                createdBy: userId || undefined,
                lines,
              } as any,
              tx,
            );
          }
        }

        await fastify.repos.fiscalYear.update(
          id,
          {
            status: "CLOSED",
            closedAt: new Date(),
            closedById: userId || null,
          },
          tx,
        );
      });

      const updated = await fastify.repos.fiscalYear.findById(id);
      return { ok: true, data: updated };
    },
  );

  // GET /fiscal-years/:id/report
  fastify.get<{ Params: { id: string } }>(
    "/:id/report",
    {
      schema: {
        tags: ["FiscalYears"],
        summary: "Get income/expense report for a fiscal year",
        security: [{ bearerAuth: [] }],
        params: { $ref: "IdParams#" },
        response: {
          200: successEnvelope(
            { type: "object" as const, additionalProperties: true },
            "Fiscal year report",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const year = await fastify.repos.fiscalYear.findById(id);
      if (!year) throw fastify.httpErrors.notFound("السنة الحسابية غير موجودة");

      const startStr = year.startDate;
      const endStr = year.endDate;

      const balancesResult = await fastify.db.execute(sql`
        SELECT
          a.id AS "accountId",
          a.account_type AS "accountType",
          a.code AS "accountCode",
          a.name AS "accountName",
          COALESCE(SUM(jl.debit), 0) AS "totalDebit",
          COALESCE(SUM(jl.credit), 0) AS "totalCredit"
        FROM accounts a
        INNER JOIN journal_lines jl ON jl.account_id = a.id
        INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE je.is_posted = true
          AND COALESCE(je.is_reversed, false) = false
          AND je.entry_date >= ${startStr}
          AND je.entry_date <= ${endStr}
          AND a.account_type IN ('revenue', 'expense')
          AND (je.notes IS NULL OR je.notes NOT LIKE 'CLOSING_ENTRY:%')
        GROUP BY a.id, a.account_type, a.code, a.name
      `);

      const balances = (balancesResult.rows ?? []) as {
        accountId: number;
        accountType: string;
        accountCode: string;
        accountName: string;
        totalDebit: string;
        totalCredit: string;
      }[];

      const revenueItems: {
        accountId: number;
        accountCode: string;
        accountName: string;
        balance: number;
      }[] = [];
      const expenseItems: {
        accountId: number;
        accountCode: string;
        accountName: string;
        balance: number;
      }[] = [];
      let totalRevenue = 0;
      let totalExpenses = 0;

      for (const b of balances) {
        const dr = Number(b.totalDebit);
        const cr = Number(b.totalCredit);
        if (b.accountType === "revenue") {
          const balance = cr - dr;
          if (balance !== 0) {
            revenueItems.push({
              accountId: b.accountId,
              accountCode: b.accountCode,
              accountName: b.accountName,
              balance,
            });
            totalRevenue += balance;
          }
        } else if (b.accountType === "expense") {
          const balance = dr - cr;
          if (balance !== 0) {
            expenseItems.push({
              accountId: b.accountId,
              accountCode: b.accountCode,
              accountName: b.accountName,
              balance,
            });
            totalExpenses += balance;
          }
        }
      }

      const netIncome = totalRevenue - totalExpenses;

      const monthlyResult = await fastify.db.execute(sql`
        SELECT
          TO_CHAR(je.entry_date::date, 'YYYY-MM') AS "month",
          a.account_type AS "accountType",
          COALESCE(SUM(jl.debit), 0) AS "totalDebit",
          COALESCE(SUM(jl.credit), 0) AS "totalCredit"
        FROM journal_lines jl
        INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
        INNER JOIN accounts a ON a.id = jl.account_id
        WHERE je.is_posted = true
          AND COALESCE(je.is_reversed, false) = false
          AND je.entry_date >= ${startStr}
          AND je.entry_date <= ${endStr}
          AND a.account_type IN ('revenue', 'expense')
          AND (je.notes IS NULL OR je.notes NOT LIKE 'CLOSING_ENTRY:%')
        GROUP BY TO_CHAR(je.entry_date::date, 'YYYY-MM'), a.account_type
        ORDER BY 1
      `);

      const monthMap = new Map<
        string,
        { month: string; revenue: number; expenses: number; net: number }
      >();
      for (const row of (monthlyResult.rows ?? []) as any[]) {
        if (!monthMap.has(row.month)) {
          monthMap.set(row.month, { month: row.month, revenue: 0, expenses: 0, net: 0 });
        }
        const m = monthMap.get(row.month)!;
        const dr = Number(row.totalDebit);
        const cr = Number(row.totalCredit);
        if (row.accountType === "revenue") m.revenue += cr - dr;
        if (row.accountType === "expense") m.expenses += dr - cr;
        m.net = m.revenue - m.expenses;
      }

      return {
        ok: true,
        data: {
          fiscalYear: {
            id: year.id,
            name: year.name,
            startDate: startStr,
            endDate: endStr,
            status: year.status,
          },
          summary: {
            totalRevenue,
            totalExpenses,
            netIncome,
            isProfit: netIncome >= 0,
          },
          revenue: revenueItems.sort((a, b) => b.balance - a.balance),
          expenses: expenseItems.sort((a, b) => b.balance - a.balance),
          monthlyBreakdown: Array.from(monthMap.values()),
        },
      };
    },
  );
};

export default fiscalYearsPlugin;
