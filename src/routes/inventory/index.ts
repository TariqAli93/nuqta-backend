import { FastifyPluginAsync } from "fastify";
import {
  GetInventoryMovementsUseCase,
  GetInventoryDashboardUseCase,
  GetExpiryAlertsUseCase,
} from "@nuqta/core";

const inventory: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /inventory/movements
  fastify.get("/movements", async (request) => {
    const query = request.query as {
      productId?: string;
      movementType?: string;
      limit?: string;
      offset?: string;
    };
    const uc = new GetInventoryMovementsUseCase(fastify.repos.inventory);
    const data = await uc.execute({
      productId: query.productId ? parseInt(query.productId, 10) : undefined,
      movementType: query.movementType,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });
    return { ok: true, data };
  });

  // GET /inventory/dashboard
  fastify.get("/dashboard", async (request) => {
    const uc = new GetInventoryDashboardUseCase(fastify.repos.inventory);
    const data = await uc.execute();
    return { ok: true, data };
  });

  // GET /inventory/expiry-alerts
  fastify.get("/expiry-alerts", async (request) => {
    const uc = new GetExpiryAlertsUseCase(fastify.repos.inventory);
    const data = await uc.execute();
    return { ok: true, data };
  });
};

export default inventory;
