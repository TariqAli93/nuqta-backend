import { FastifyPluginAsync } from "fastify";
import {
  GetInventoryMovementsUseCase,
  GetInventoryDashboardUseCase,
  GetExpiryAlertsUseCase,
  ReconcileStockUseCase,
} from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const InventoryMovementSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    productId: { type: "integer" },
    batchId: { type: "integer", nullable: true },
    movementType: { type: "string", enum: ["in", "out", "adjust"] },
    reason: {
      type: "string",
      enum: ["sale", "purchase", "return", "damage", "manual", "opening"],
    },
    quantityBase: { type: "integer" },
    unitName: { type: "string" },
    unitFactor: { type: "integer" },
    stockBefore: { type: "integer" },
    stockAfter: { type: "integer" },
    costPerUnit: { type: "integer", nullable: true },
    totalCost: { type: "integer", nullable: true },
    sourceType: {
      type: "string",
      nullable: true,
      enum: ["sale", "purchase", "adjustment", "return"],
    },
    sourceId: { type: "integer", nullable: true },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const MovementsQuerySchema = {
  type: "object" as const,
  properties: {
    productId: {
      type: "string",
      pattern: "^\\d+$",
      description: "Filter by product",
    },
    movementType: { type: "string", enum: ["in", "out", "adjust"] },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

export const getInventoryMovementsSchema = {
  tags: ["Inventory"],
  summary: "List inventory movements",
  security: [{ bearerAuth: [] }],
  querystring: MovementsQuerySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          items: { type: "array" as const, items: InventoryMovementSchema },
          total: { type: "integer" },
        },
      },
      "List of inventory movements with pagination",
    ),
    ...ErrorResponses,
  },
} as const;

const getInventoryDashboardSchema = {
  tags: ["Inventory"],
  summary: "Get inventory dashboard",
  description:
    "Overview of inventory health: low stock, expiring items, totals.",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Inventory dashboard data",
    ),
    ...ErrorResponses,
  },
} as const;

const getExpiryAlertsSchema = {
  tags: ["Inventory"],
  summary: "Get expiry alerts",
  description: "Products nearing or past expiry date.",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Expiry alerts",
    ),
    ...ErrorResponses,
  },
} as const;

const reconcileInventorySchema = {
  tags: ["Inventory"],
  summary: "Reconcile inventory stock",
  description:
    "Compare cached stock against inventory movements ledger. " +
    "Supports pagination for large datasets. " +
    "Pass repair=true to auto-correct all discrepancies.",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object" as const,
    properties: {
      repair: {
        type: "string",
        enum: ["true", "false"],
        description: "If true, auto-correct all stock discrepancies",
      },
      driftOnly: {
        type: "string",
        enum: ["true", "false"],
        description:
          "If true (default), only return products with drift. If false, return all products.",
      },
      search: {
        type: "string",
        description: "Filter products by name (partial match)",
      },
      limit: {
        type: "string",
        pattern: "^\\d+$",
        description: "Page size (default: 50, max: 200)",
      },
      offset: {
        type: "string",
        pattern: "^\\d+$",
        description: "Offset for pagination",
      },
    },
  } as const,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          items: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                productId: { type: "integer" },
                productName: { type: "string" },
                cachedStock: { type: "integer" },
                ledgerStock: { type: "integer" },
                drift: { type: "integer" },
              },
            },
          },
          total: { type: "integer" },
          totalDrift: { type: "integer" },
          corrected: { type: "integer", nullable: true },
        },
      },
      "Reconciliation result with pagination",
    ),
    ...ErrorResponses,
  },
} as const;

const inventory: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /inventory/movements
  fastify.get(
    "/movements",
    {
      schema: getInventoryMovementsSchema,
      preHandler: requirePermission("inventory:read"),
    },
    async (request) => {
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
    },
  );

  // GET /inventory/dashboard
  fastify.get(
    "/dashboard",
    {
      schema: getInventoryDashboardSchema,
      preHandler: requirePermission("inventory:read"),
    },
    async (request) => {
      const uc = new GetInventoryDashboardUseCase(fastify.repos.inventory);
      const data = await uc.execute();
      return { ok: true, data };
    },
  );

  // GET /inventory/expiry-alerts
  fastify.get(
    "/expiry-alerts",
    {
      schema: getExpiryAlertsSchema,
      preHandler: requirePermission("inventory:read"),
    },
    async (request) => {
      const uc = new GetExpiryAlertsUseCase(fastify.repos.inventory);
      const data = await uc.execute();
      return { ok: true, data };
    },
  );

  // POST /inventory/reconcile
  fastify.post(
    "/reconcile",
    {
      schema: reconcileInventorySchema,
      preHandler: requirePermission("inventory:reconcile"),
    },
    async (request) => {
      const query = request.query as {
        repair?: string;
        driftOnly?: string;
        search?: string;
        limit?: string;
        offset?: string;
      };

      const uc = new ReconcileStockUseCase(
        fastify.repos.product,
        fastify.repos.inventory,
      );

      // Repair mode: fix all drift in a single batch UPDATE
      if (query.repair === "true") {
        const corrected = await uc.repair();

        fastify.emitDomainEvent("inventory:reconciled", { corrected });

        return {
          ok: true,
          data: { items: [], total: 0, totalDrift: 0, corrected },
        };
      }

      // Clamp limit to [1, 200]
      const rawLimit = query.limit ? parseInt(query.limit, 10) : 50;
      const limit = Math.min(Math.max(rawLimit, 1), 200);

      const data = await uc.execute(
        {
          driftOnly: query.driftOnly !== "false",
          search: query.search,
          limit,
          offset: query.offset ? parseInt(query.offset, 10) : undefined,
        },
        String(request.user?.sub ?? "system"),
      );
      return { ok: true, data };
    },
  );
};

export default inventory;
