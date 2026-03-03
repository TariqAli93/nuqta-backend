/**
 * Product domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
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
      { type: "object" as const, additionalProperties: true },
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
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Reconciliation result",
    ),
    ...ErrorResponses,
  },
} as const;

// ─── GET /products/:id ─────────────────────────────────────────────

export const getProductByIdSchema = {
  tags: ["Products"],
  summary: "Get product by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(ProductSchema, "Product details"),
    ...ErrorResponses,
  },
} as const;

// ─── Product Units ─────────────────────────────────────────────────

const ProductUnitSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    productId: { type: "integer" },
    unitName: { type: "string" },
    factorToBase: { type: "number" },
    barcode: { type: "string", nullable: true },
    sellingPrice: { type: "integer", nullable: true },
    isDefault: { type: "boolean" },
    isActive: { type: "boolean" },
  },
};

const CreateUnitBodySchema = {
  type: "object" as const,
  required: ["unitName", "factorToBase"],
  properties: {
    unitName: { type: "string", minLength: 1 },
    factorToBase: { type: "number", minimum: 0.001 },
    barcode: { type: "string", nullable: true },
    sellingPrice: { type: "integer", minimum: 0, nullable: true },
    isDefault: { type: "boolean", default: false },
    isActive: { type: "boolean", default: true },
  },
  additionalProperties: false,
} as const;

const UpdateUnitBodySchema = {
  type: "object" as const,
  properties: {
    unitName: { type: "string", minLength: 1 },
    factorToBase: { type: "number", minimum: 0.001 },
    barcode: { type: "string", nullable: true },
    sellingPrice: { type: "integer", minimum: 0, nullable: true },
    isDefault: { type: "boolean" },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

export const getProductUnitsSchema = {
  tags: ["Products"],
  summary: "List product units",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successArrayEnvelope(ProductUnitSchema, "Product units"),
    ...ErrorResponses,
  },
} as const;

export const createProductUnitSchema = {
  tags: ["Products"],
  summary: "Create product unit",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: CreateUnitBodySchema,
  response: {
    200: successEnvelope(ProductUnitSchema, "Created unit"),
    ...ErrorResponses,
  },
} as const;

export const updateProductUnitSchema = {
  tags: ["Products"],
  summary: "Update product unit",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object" as const,
    required: ["id"],
    properties: { id: { type: "string", pattern: "^\\d+$" } },
  },
  body: UpdateUnitBodySchema,
  response: {
    200: successEnvelope(ProductUnitSchema, "Updated unit"),
    ...ErrorResponses,
  },
} as const;

export const deleteProductUnitSchema = {
  tags: ["Products"],
  summary: "Delete product unit",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object" as const,
    required: ["id"],
    properties: { id: { type: "string", pattern: "^\\d+$" } },
  },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

export const setDefaultUnitSchema = {
  tags: ["Products"],
  summary: "Set default unit",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object" as const,
    required: ["id", "uid"],
    properties: {
      id: { type: "string", pattern: "^\\d+$" },
      uid: { type: "string", pattern: "^\\d+$" },
    },
  },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

// ─── Product Batches ───────────────────────────────────────────────

const ProductBatchSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    productId: { type: "integer" },
    batchNumber: { type: "string" },
    expiryDate: { type: "string", nullable: true },
    quantityReceived: { type: "integer" },
    quantityOnHand: { type: "integer" },
    costPerUnit: { type: "integer" },
    status: { type: "string", enum: ["active", "depleted", "expired"] },
  },
};

const CreateBatchBodySchema = {
  type: "object" as const,
  required: ["batchNumber", "quantityReceived", "costPerUnit"],
  properties: {
    batchNumber: { type: "string", minLength: 1 },
    expiryDate: { type: "string", format: "date", nullable: true },
    quantityReceived: { type: "integer", minimum: 1 },
    quantityOnHand: { type: "integer", minimum: 0 },
    costPerUnit: { type: "integer", minimum: 0 },
    status: {
      type: "string",
      enum: ["active", "depleted", "expired"],
      default: "active",
    },
  },
  additionalProperties: false,
} as const;

export const getProductBatchesSchema = {
  tags: ["Products"],
  summary: "List product batches",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successArrayEnvelope(ProductBatchSchema, "Product batches"),
    ...ErrorResponses,
  },
} as const;

export const createProductBatchSchema = {
  tags: ["Products"],
  summary: "Create product batch",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: CreateBatchBodySchema,
  response: {
    200: successEnvelope(ProductBatchSchema, "Created batch"),
    ...ErrorResponses,
  },
} as const;
