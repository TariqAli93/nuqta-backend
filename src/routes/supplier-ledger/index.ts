import { FastifyPluginAsync } from "fastify";
import {
  GetSupplierLedgerUseCase,
  RecordSupplierPaymentUseCase,
  ReconcileSupplierBalanceUseCase,
} from "@nuqta/core";

const supplierLedger: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /supplier-ledger/:supplierId
  fastify.get<{ Params: { supplierId: string } }>(
    "/:supplierId",
    async (request) => {
      const supplierId = parseInt(request.params.supplierId, 10);
      const query = request.query as {
        dateFrom?: string;
        dateTo?: string;
        limit?: string;
        offset?: string;
      };
      const uc = new GetSupplierLedgerUseCase(fastify.repos.supplierLedger);
      const data = await uc.execute({
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
    async (request) => {
      const supplierId = parseInt(request.params.supplierId, 10);
      const body = request.body as {
        amount: number;
        paymentMethod: string;
        notes?: string;
        idempotencyKey?: string;
      };
      const userId = request.user?.sub || 1;
      const uc = new RecordSupplierPaymentUseCase(
        fastify.repos.supplierLedger,
        fastify.repos.supplier,
        fastify.repos.payment,
        fastify.repos.accounting,
        fastify.repos.audit,
      );
      const data = await uc.execute({ supplierId, ...body }, userId);
      return { ok: true, data };
    },
  );

  // POST /supplier-ledger/reconcile
  fastify.post("/reconcile", async (request) => {
    const { repair } = (request.query as { repair?: string }) || {};
    const uc = new ReconcileSupplierBalanceUseCase(
      fastify.repos.supplier,
      fastify.repos.supplierLedger,
    );
    if (repair === "true") {
      const corrected = await uc.repair();
      return { ok: true, data: { corrected } };
    }
    const data = await uc.execute();
    return { ok: true, data };
  });
};

export default supplierLedger;
