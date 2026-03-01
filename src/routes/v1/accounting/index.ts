import { FastifyPluginAsync } from "fastify";
import {
  GetAccountsUseCase,
  GetJournalEntriesUseCase,
  GetEntryByIdUseCase,
  GetTrialBalanceUseCase,
  GetProfitLossUseCase,
  GetBalanceSheetUseCase,
  InitializeAccountingUseCase,
} from "@nuqta/core";
import {
  getAccountsSchema,
  getJournalEntriesSchema,
  getEntryByIdSchema,
  getTrialBalanceSchema,
  getProfitLossSchema,
  getBalanceSheetSchema,
  initializeAccountingSchema,
  getAccountingStatusSchema,
} from "../../../schemas/accounting.js";

const accounting: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /accounting/accounts
  fastify.get("/accounts", { schema: getAccountsSchema }, async (request) => {
    const uc = new GetAccountsUseCase(fastify.repos.accounting);
    const data = await uc.execute();
    return { ok: true, data };
  });

  // GET /accounting/journal-entries
  fastify.get(
    "/journal-entries",
    { schema: getJournalEntriesSchema },
    async (request) => {
      const query = request.query as {
        sourceType?: string;
        dateFrom?: string;
        dateTo?: string;
        isPosted?: string;
        limit?: string;
        offset?: string;
      };
      const uc = new GetJournalEntriesUseCase(fastify.repos.accounting);
      const data = await uc.execute({
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

  // GET /accounting/journal-entries/:id
  fastify.get<{ Params: { id: string } }>(
    "/journal-entries/:id",
    { schema: getEntryByIdSchema },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new GetEntryByIdUseCase(fastify.repos.accounting);
      const data = await uc.execute(id);
      return { ok: true, data };
    },
  );

  // GET /accounting/trial-balance
  fastify.get(
    "/trial-balance",
    { schema: getTrialBalanceSchema },
    async (request) => {
      const query = request.query as { dateFrom?: string; dateTo?: string };
      const uc = new GetTrialBalanceUseCase(fastify.repos.accounting);
      const data = await uc.execute({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/profit-loss
  fastify.get(
    "/profit-loss",
    { schema: getProfitLossSchema },
    async (request) => {
      const query = request.query as { dateFrom?: string; dateTo?: string };
      const uc = new GetProfitLossUseCase(fastify.repos.accounting);
      const data = await uc.execute({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/balance-sheet
  fastify.get(
    "/balance-sheet",
    { schema: getBalanceSheetSchema },
    async (request) => {
      const query = request.query as { fromDate?: string; toDate?: string };
      const uc = new GetBalanceSheetUseCase(fastify.repos.accounting);
      const data = await uc.execute({
        fromDate: query.fromDate,
        toDate: query.toDate,
      });
      return { ok: true, data };
    },
  );

  // POST /accounting/initialize
  fastify.post(
    "/initialize",
    { schema: initializeAccountingSchema },
    async (request) => {
      const body = request.body as any;
      const uc = new InitializeAccountingUseCase(
        fastify.repos.settings,
        fastify.repos.accounting,
      );
      const data = await uc.execute(body || {});
      return { ok: true, data };
    },
  );

  // GET /accounting/status
  fastify.get(
    "/status",
    { schema: getAccountingStatusSchema },
    async (request) => {
      const uc = new InitializeAccountingUseCase(
        fastify.repos.settings,
        fastify.repos.accounting,
      );
      const data = await uc.getStatus();
      return { ok: true, data };
    },
  );
};

export default accounting;
