import { FastifyPluginAsync } from "fastify";
import {
  GetCustomerLedgerUseCase,
  RecordCustomerPaymentUseCase,
  AddCustomerLedgerAdjustmentUseCase,
  ReconcileCustomerDebtUseCase,
} from "@nuqta/core";
import {
  getCustomerLedgerSchema,
  recordCustomerPaymentSchema,
  addCustomerAdjustmentSchema,
  reconcileCustomerDebtSchema,
} from "../../../schemas/customer-ledger.js";

const customerLedger: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /customer-ledger/:customerId
  fastify.get<{ Params: { customerId: string } }>(
    "/:customerId",
    { schema: getCustomerLedgerSchema },
    async (request) => {
      const customerId = parseInt(request.params.customerId, 10);
      const query = request.query as {
        dateFrom?: string;
        dateTo?: string;
        limit?: string;
        offset?: string;
      };
      const uc = new GetCustomerLedgerUseCase(fastify.repos.customerLedger);
      const data = await uc.execute({
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
    { schema: recordCustomerPaymentSchema },
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
      );
      const data = await uc.execute({ customerId, ...body }, userId);
      return { ok: true, data };
    },
  );

  // POST /customer-ledger/:customerId/adjustments
  fastify.post<{ Params: { customerId: string } }>(
    "/:customerId/adjustments",
    { schema: addCustomerAdjustmentSchema },
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
    { schema: reconcileCustomerDebtSchema },
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
