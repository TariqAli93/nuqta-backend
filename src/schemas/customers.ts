/**
 * Customer domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
  SuccessNullResponse,
} from "./common.js";

const CustomerSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    phone: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    totalPurchases: { type: "integer" },
    totalDebt: { type: "integer" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const CreateCustomerBodySchema = {
  type: "object" as const,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    isActive: { type: "boolean", default: true },
  },
  additionalProperties: false,
} as const;

const UpdateCustomerBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    phone: { type: "string", nullable: true },
    address: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

const CustomerListQuerySchema = {
  type: "object" as const,
  properties: {
    search: { type: "string", description: "Search by name" },
    page: {
      type: "string",
      pattern: "^\\d+$",
      description: "Page number (1-based)",
    },
    limit: { type: "string", pattern: "^\\d+$", description: "Items per page" },
  },
} as const;

export const getCustomersSchema = {
  tags: ["Customers"],
  summary: "List customers",
  security: [{ bearerAuth: [] }],
  querystring: CustomerListQuerySchema,
  response: {
    200: successArrayEnvelope(CustomerSchema, "List of customers"),
    ...ErrorResponses,
  },
} as const;

export const createCustomerSchema = {
  tags: ["Customers"],
  summary: "Create a customer",
  security: [{ bearerAuth: [] }],
  body: CreateCustomerBodySchema,
  response: {
    200: successEnvelope(CustomerSchema, "Created customer"),
    ...ErrorResponses,
  },
} as const;

export const updateCustomerSchema = {
  tags: ["Customers"],
  summary: "Update a customer",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateCustomerBodySchema,
  response: {
    200: successEnvelope(CustomerSchema, "Updated customer"),
    ...ErrorResponses,
  },
} as const;

export const deleteCustomerSchema = {
  tags: ["Customers"],
  summary: "Delete a customer",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;
