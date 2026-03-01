/**
 * Inventory domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
} from "./common.js";

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
    200: successArrayEnvelope(InventoryMovementSchema, "Inventory movements"),
    ...ErrorResponses,
  },
} as const;

export const getInventoryDashboardSchema = {
  tags: ["Inventory"],
  summary: "Get inventory dashboard",
  description:
    "Overview of inventory health: low stock, expiring items, totals.",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(
      { type: "object" as const },
      "Inventory dashboard data",
    ),
    ...ErrorResponses,
  },
} as const;

export const getExpiryAlertsSchema = {
  tags: ["Inventory"],
  summary: "Get expiry alerts",
  description: "Products nearing or past expiry date.",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope({ type: "object" as const }, "Expiry alerts"),
    ...ErrorResponses,
  },
} as const;
