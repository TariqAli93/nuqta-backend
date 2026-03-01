/**
 * Supplier domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
  SuccessNullResponse,
} from "./common.js";

const SupplierSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    phone: { type: "string", nullable: true },
    phone2: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    openingBalance: { type: "integer" },
    currentBalance: { type: "integer" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const CreateSupplierBodySchema = {
  type: "object" as const,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    phone2: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    openingBalance: { type: "integer", default: 0 },
    isActive: { type: "boolean", default: true },
  },
  additionalProperties: false,
} as const;

const UpdateSupplierBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    phone2: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    openingBalance: { type: "integer" },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const SupplierListQuerySchema = {
  type: "object" as const,
  properties: {
    search: { type: "string", description: "Search by name" },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

export const getSuppliersSchema = {
  tags: ["Suppliers"],
  summary: "List suppliers",
  security: [{ bearerAuth: [] }],
  querystring: SupplierListQuerySchema,
  response: {
    200: successArrayEnvelope(SupplierSchema, "List of suppliers"),
    ...ErrorResponses,
  },
} as const;

export const getSupplierByIdSchema = {
  tags: ["Suppliers"],
  summary: "Get supplier by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(SupplierSchema, "Supplier details"),
    ...ErrorResponses,
  },
} as const;

export const createSupplierSchema = {
  tags: ["Suppliers"],
  summary: "Create a supplier",
  security: [{ bearerAuth: [] }],
  body: CreateSupplierBodySchema,
  response: {
    200: successEnvelope(SupplierSchema, "Created supplier"),
    ...ErrorResponses,
  },
} as const;

export const updateSupplierSchema = {
  tags: ["Suppliers"],
  summary: "Update a supplier",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateSupplierBodySchema,
  response: {
    200: successEnvelope(SupplierSchema, "Updated supplier"),
    ...ErrorResponses,
  },
} as const;

export const deleteSupplierSchema = {
  tags: ["Suppliers"],
  summary: "Delete a supplier",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;
