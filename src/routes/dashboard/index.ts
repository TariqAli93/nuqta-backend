import { FastifyPluginAsync } from "fastify";
import { GetDashboardStatsUseCase } from "@nuqta/core";

const dashboard: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /dashboard/stats
  fastify.get("/stats", async (request) => {
    const uc = new GetDashboardStatsUseCase(
      fastify.repos.sale,
      fastify.repos.product,
    );
    const data = await uc.execute();
    return { ok: true, data };
  });
};

export default dashboard;
