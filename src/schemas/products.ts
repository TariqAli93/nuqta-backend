/**
 * Product domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  SuccessNullResponse,
} from "./common.js";

const ProductSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    sku: { type: "string", nullable: true },
    barcode: { type: "string", nullable: true },
    categoryId: { type: "integer", nullable: true },
    description: { type: "string", nullable: true },
    costPrice: { type: "integer" },
    sellingPrice: { type: "integer" },
    currency: { type: "string" },
    stock: { type: "integer" },
    minStock: { type: "integer" },
    unit: { type: "string" },
    supplier: { type: "string", nullable: true },
    supplierId: { type: "integer", nullable: true },
    expireDate: { type: "string", nullable: true },
    isExpire: { type: "boolean" },
    status: {
      type: "string",
      enum: ["available", "out_of_stock", "discontinued"],
    },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const CreateProductBodySchema = {
  type: "object" as const,
  required: ["name", "costPrice", "sellingPrice"],
  properties: {
    name: { type: "string", minLength: 1 },
    sku: { type: "string", nullable: true },
    barcode: { type: "string", nullable: true },
    categoryId: { type: "integer", nullable: true },
    description: { type: "string", nullable: true },
    costPrice: { type: "integer", minimum: 0 },
    sellingPrice: { type: "integer", minimum: 0 },
    currency: { type: "string", default: "IQD" },
    stock: { type: "integer", minimum: 0, default: 0 },
    minStock: { type: "integer", minimum: 0, default: 0 },
    unit: { type: "string", default: "piece" },
    supplier: { type: "string", nullable: true },
    supplierId: { type: "integer", nullable: true },
    expireDate: { type: "string", nullable: true, format: "date-time" },
    isExpire: { type: "boolean", default: false },
    status: {
      type: "string",
      enum: ["available", "out_of_stock", "discontinued"],
      default: "available",
    },
    isActive: { type: "boolean", default: true },
  },
} as const;

const UpdateProductBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    sku: { type: "string", nullable: true },
    barcode: { type: "string", nullable: true },
    categoryId: { type: "integer", nullable: true },
    description: { type: "string", nullable: true },
    costPrice: { type: "integer", minimum: 0 },
    sellingPrice: { type: "integer", minimum: 0 },
    currency: { type: "string" },
    stock: { type: "integer", minimum: 0 },
    minStock: { type: "integer", minimum: 0 },
    unit: { type: "string" },
    supplier: { type: "string", nullable: true },
    supplierId: { type: "integer", nullable: true },
    expireDate: { type: "string", nullable: true, format: "date-time" },
    isExpire: { type: "boolean" },
    status: {
      type: "string",
      enum: ["available", "out_of_stock", "discontinued"],
    },
    isActive: { type: "boolean" },
  },
} as const;

const ProductListQuerySchema = {
  type: "object" as const,
  properties: {
    search: { type: "string", description: "Search by product name/SKU" },
    page: { type: "string", pattern: "^\\d+$" },
    limit: { type: "string", pattern: "^\\d+$" },
    categoryId: {
      type: "string",
      pattern: "^\\d+$",
      description: "Filter by category",
    },
    supplierId: {
      type: "string",
      pattern: "^\\d+$",
      description: "Filter by supplier",
    },
    status: {
      type: "string",
      enum: ["available", "out_of_stock", "discontinued"],
    },
    lowStockOnly: {
      type: "string",
      enum: ["true", "false"],
      description: "Only low-stock items",
    },
    expiringSoonOnly: {
      type: "string",
      enum: ["true", "false"],
      description: "Only expiring soon",
    },
  },
} as const;

const AdjustStockBodySchema = {
  type: "object" as const,
  required: ["quantityChange"],
  properties: {
    quantityChange: {
      type: "number",
      description: "Positive to add, negative to subtract",
    },
    reason: { type: "string", enum: ["manual", "damage", "opening"] },
    notes: { type: "string", nullable: true },
    batchId: { type: "integer", nullable: true },
    unitName: { type: "string" },
    unitFactor: { type: "integer", minimum: 1 },
  },
  additionalProperties: false,
} as const;

export const getProductsSchema = {
  tags: ["Products"],
  summary: "List products",
  security: [{ bearerAuth: [] }],
  querystring: ProductListQuerySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          items: { type: "array" as const, items: ProductSchema },
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
        },
      },
      "Paginated product list",
    ),
    ...ErrorResponses,
  },
} as const;

export const createProductSchema = {
  tags: ["Products"],
  summary: "Create a product",
  security: [{ bearerAuth: [] }],
  body: CreateProductBodySchema,
  response: {
    200: successEnvelope(ProductSchema, "Created product"),
    ...ErrorResponses,
  },
} as const;

export const updateProductSchema = {
  tags: ["Products"],
  summary: "Update a product",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateProductBodySchema,
  response: {
    200: successEnvelope(ProductSchema, "Updated product"),
    ...ErrorResponses,
  },
} as const;

export const deleteProductSchema = {
  tags: ["Products"],
  summary: "Delete a product",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

export const adjustStockSchema = {
  tags: ["Products"],
  summary: "Adjust product stock",
  description: "Manually adjust stock quantity for a product.",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: AdjustStockBodySchema,
  response: {
    200: successEnvelope(
      { type: "object" as const },
      "Stock adjustment result",
    ),
    ...ErrorResponses,
  },
} as const;

export const reconcileStockSchema = {
  tags: ["Products"],
  summary: "Reconcile product stock",
  description: "Reconcile stock based on inventory movements.",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope({ type: "object" as const }, "Reconciliation result"),
    ...ErrorResponses,
  },
} as const;
