/**
 * Category domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
  SuccessNullResponse,
} from "./common.js";

const CategorySchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const CreateCategoryBodySchema = {
  type: "object" as const,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean", default: true },
  },
  additionalProperties: false,
} as const;

const UpdateCategoryBodySchema = {
  type: "object" as const,
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string", nullable: true },
    isActive: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

export const getCategoriesSchema = {
  tags: ["Categories"],
  summary: "List all categories",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(CategorySchema, "List of categories"),
    ...ErrorResponses,
  },
} as const;

export const createCategorySchema = {
  tags: ["Categories"],
  summary: "Create a category",
  security: [{ bearerAuth: [] }],
  body: CreateCategoryBodySchema,
  response: {
    200: successEnvelope(CategorySchema, "Created category"),
    ...ErrorResponses,
  },
} as const;

export const updateCategorySchema = {
  tags: ["Categories"],
  summary: "Update a category",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: UpdateCategoryBodySchema,
  response: {
    200: successEnvelope(CategorySchema, "Updated category"),
    ...ErrorResponses,
  },
} as const;

export const deleteCategorySchema = {
  tags: ["Categories"],
  summary: "Delete a category",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;
