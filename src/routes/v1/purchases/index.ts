import { FastifyPluginAsync } from "fastify";
import {
  GetPurchasesUseCase,
  GetPurchaseByIdUseCase,
  CreatePurchaseUseCase,
  AddPurchasePaymentUseCase,
  type CreatePurchaseInput,
  type AddPurchasePaymentInput,
} from "@nuqta/core";
import {
  getPurchasesSchema,
  getPurchaseByIdSchema,
  createPurchaseSchema,
  addPurchasePaymentSchema,
} from "../../../schemas/purchases.js";

const purchases: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /purchases
  fastify.get("/", { schema: getPurchasesSchema }, async (request) => {
    const query = request.query as {
      search?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
    const uc = new GetPurchasesUseCase(fastify.repos.purchase);
    const data = await uc.execute({
      search: query.search,
      status: query.status,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });
    return { ok: true, data };
  });

  // GET /purchases/:id
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { schema: getPurchaseByIdSchema },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const uc = new GetPurchaseByIdUseCase(fastify.repos.purchase);
      const data = await uc.execute(id);
      return { ok: true, data };
    },
  );

  // POST /purchases
  fastify.post("/", { schema: createPurchaseSchema }, async (request) => {
    const body = request.body as CreatePurchaseInput;
    const userId = request.user?.sub || 1;
    const uc = new CreatePurchaseUseCase(
      fastify.repos.purchase,
      fastify.repos.supplier,
      fastify.repos.payment,
      fastify.repos.supplierLedger,
      fastify.repos.accounting,
      fastify.repos.settings,
      fastify.repos.audit,
    );
    const result = await uc.execute(body, userId);
    return { ok: true, data: result };
  });

  // POST /purchases/:id/payments
  fastify.post<{ Params: { id: string } }>(
    "/:id/payments",
    { schema: addPurchasePaymentSchema },
    async (request) => {
      const purchaseId = parseInt(request.params.id, 10);
      const body = request.body as Omit<AddPurchasePaymentInput, "purchaseId">;
      const userId = request.user?.sub || 1;
      const uc = new AddPurchasePaymentUseCase(
        fastify.repos.purchase,
        fastify.repos.payment,
        fastify.repos.supplierLedger,
        fastify.repos.accounting,
        fastify.repos.settings,
        fastify.repos.audit,
      );
      const result = await uc.execute({ purchaseId, ...body }, userId);
      return { ok: true, data: result };
    },
  );
};

export default purchases;
