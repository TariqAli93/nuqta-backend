import { FastifyPluginAsync } from "fastify";
import {
  GetSaleByIdUseCase,
  CreateSaleUseCase,
  AddPaymentUseCase,
  type CreateSaleInput,
  type AddPaymentInput,
} from "@nuqta/core";
import { FifoService } from "@nuqta/data";
import {
  getSalesSchema,
  getSaleByIdSchema,
  createSaleSchema,
  addSalePaymentSchema,
} from "../../../schemas/sales.js";

const sales: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /sales
  fastify.get("/", { schema: getSalesSchema }, async (request) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      startDate?: string;
      endDate?: string;
    };
    const result = await fastify.repos.sale.findAll({
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return { ok: true, data: result };
  });

  // GET /sales/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { schema: getSaleByIdSchema },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new GetSaleByIdUseCase(fastify.repos.sale);
      const data = await uc.execute(id);
      return { ok: true, data };
    },
  );

  // POST /sales
  fastify.post("/", { schema: createSaleSchema }, async (request) => {
    const body = request.body as CreateSaleInput;
    const userId = request.user?.sub || 1;
    const fifoService = new FifoService(fastify.db);
    const uc = new CreateSaleUseCase(
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
    );
    const result = await uc.executeCommitPhase(body, userId);
    return { ok: true, data: result.createdSale };
  });

  // POST /sales/:id/payments
  fastify.post<{ Params: { id: string } }>(
    "/:id/payments",
    { schema: addSalePaymentSchema },
    async (request) => {
      const saleId = parseInt(request.params.id, 10);
      const body = request.body as Omit<AddPaymentInput, "saleId">;
      const userId = request.user?.sub || 1;
      const uc = new AddPaymentUseCase(
        fastify.repos.sale,
        fastify.repos.payment,
        fastify.repos.customer,
        fastify.repos.customerLedger,
        fastify.repos.accounting,
        fastify.repos.settings,
        fastify.repos.audit,
      );
      const result = await uc.execute({ saleId, ...body }, userId);
      return { ok: true, data: result };
    },
  );
};

export default sales;
