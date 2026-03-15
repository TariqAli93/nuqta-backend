import { FastifyPluginAsync } from "fastify";
import { GetDashboardStatsUseCase } from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const DashboardStatsSchema = {
  type: "object" as const,
  properties: {
    salesToday: {
      type: "object" as const,
      properties: {
        revenue: { type: "integer" },
        count: { type: "integer" },
        cash: { type: "integer" },
        card: { type: "integer" },
        transfer: { type: "integer" },
      },
    },
    lowStockCount: { type: "integer", description: "Products below min stock" },
    topProducts: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          productId: { type: "integer" },
          productName: { type: "string" },
          quantity: { type: "integer" },
          revenue: { type: "integer" },
        },
      },
    },
  },
};

const getDashboardStatsSchema = {
  tags: ["Dashboard"],
  summary: "Get dashboard statistics",
  description: "Aggregated overview metrics for sales and inventory.",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(DashboardStatsSchema, "Dashboard statistics"),
    ...ErrorResponses,
  },
} as const;

const dashboard: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /dashboard/stats
  fastify.get(
    "/stats",
    {
      schema: getDashboardStatsSchema,
      preHandler: requirePermission("dashboard:read"),
    },
    async (request) => {
      const uc = new GetDashboardStatsUseCase(
        fastify.repos.sale,
        fastify.repos.product,
      );
      const data = await uc.execute();
      return { ok: true, data };
    },
  );
};

export default dashboard;
