/**
 * Dashboard domain schemas.
 */
import { ErrorResponses, successEnvelope } from "./common.js";

const DashboardStatsSchema = {
  type: "object" as const,
  properties: {
    totalSales: { type: "integer", description: "Total sales count" },
    totalRevenue: {
      type: "integer",
      description: "Total revenue in base currency",
    },
    totalProducts: { type: "integer", description: "Total product count" },
    lowStockCount: { type: "integer", description: "Products below min stock" },
    todaySales: { type: "integer", description: "Sales created today" },
    todayRevenue: {
      type: "integer",
      description: "Revenue from today's sales",
    },
  },
};

export const getDashboardStatsSchema = {
  tags: ["Dashboard"],
  summary: "Get dashboard statistics",
  description: "Aggregated overview metrics for sales and inventory.",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(DashboardStatsSchema, "Dashboard statistics"),
    ...ErrorResponses,
  },
} as const;
