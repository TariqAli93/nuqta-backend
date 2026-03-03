import { FastifyPluginAsync } from "fastify";

const licensing: FastifyPluginAsync = async (fastify) => {
  // GET /licensing/status – mock: always returns active license
  fastify.get("/status", async (_request, _reply) => {
    return {
      ok: true,
      data: {
        status: "active",
        plan: "premium",
        licensedTo: "Development User",
        expiresAt: "2099-12-31T23:59:59.000Z",
        features: {
          maxUsers: 999,
          maxProducts: 999999,
          multiCurrency: true,
          advancedReports: true,
        },
      },
    };
  });
};

export default licensing;
