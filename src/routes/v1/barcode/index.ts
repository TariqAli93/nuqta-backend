import { FastifyPluginAsync } from "fastify";
import { normalizeBarcodeLayoutJson, type BarcodeTemplate } from "../../../domain/index.js";
import {
  ErrorResponses,
  successArrayEnvelope,
  successEnvelope,
  SuccessNullResponse,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const BarcodeTemplateSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    width: { type: "integer", minimum: 1 },
    height: { type: "integer", minimum: 1 },
    barcodeType: {
      type: "string",
      enum: ["CODE128", "EAN13", "QR"],
    },
    showPrice: { type: "boolean" },
    showName: { type: "boolean" },
    showBarcode: { type: "boolean" },
    showExpiry: { type: "boolean" },
    layoutJson: { type: "string", nullable: true },
    isDefault: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
  },
} as const;

const BarcodePrintJobSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    templateId: { type: "integer" },
    productId: { type: "integer" },
    productName: { type: "string" },
    barcode: { type: "string", nullable: true },
    price: { type: "integer", nullable: true },
    expiryDate: { type: "string", nullable: true },
    quantity: { type: "integer", minimum: 1 },
    status: {
      type: "string",
      enum: ["pending", "printing", "printed", "failed"],
    },
    printedAt: { type: "string", format: "date-time", nullable: true },
    printError: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
} as const;

const CreateBarcodeTemplateBodySchema = {
  type: "object" as const,
  required: ["name", "width", "height"],
  properties: {
    name: { type: "string", minLength: 1 },
    width: { type: "integer", minimum: 1 },
    height: { type: "integer", minimum: 1 },
    barcodeType: {
      type: "string",
      enum: ["CODE128", "EAN13", "QR"],
      default: "CODE128",
    },
    showPrice: { type: "boolean", default: true },
    showName: { type: "boolean", default: true },
    showBarcode: { type: "boolean", default: true },
    showExpiry: { type: "boolean", default: false },
    layoutJson: { type: "string", nullable: true },
    isDefault: { type: "boolean", default: false },
  },
  additionalProperties: false,
} as const;

const getBarcodeTemplatesSchema = {
  tags: ["Barcode"],
  summary: "List barcode templates",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(BarcodeTemplateSchema, "Barcode templates"),
    ...ErrorResponses,
  },
} as const;

const createBarcodeTemplateSchema = {
  tags: ["Barcode"],
  summary: "Create barcode template",
  security: [{ bearerAuth: [] }],
  body: CreateBarcodeTemplateBodySchema,
  response: {
    200: successEnvelope(BarcodeTemplateSchema, "Created barcode template"),
    ...ErrorResponses,
  },
} as const;

const getBarcodePrintJobsSchema = {
  tags: ["Barcode"],
  summary: "List barcode print jobs",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object" as const,
    properties: {
      productId: {
        type: "string",
        pattern: "^\\d+$",
      },
      status: {
        type: "string",
        enum: ["pending", "printing", "printed", "failed"],
      },
      limit: {
        type: "string",
        pattern: "^\\d+$",
      },
      offset: {
        type: "string",
        pattern: "^\\d+$",
      },
    },
  },
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          items: {
            type: "array" as const,
            items: BarcodePrintJobSchema,
          },
          total: { type: "integer", minimum: 0 },
        },
      },
      "Barcode print jobs",
    ),
    ...ErrorResponses,
  },
} as const;

const deleteBarcodeTemplateSchema = {
  tags: ["Barcode"],
  summary: "Delete barcode template",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: SuccessNullResponse,
    ...ErrorResponses,
  },
} as const;

const barcode: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.get(
    "/templates",
    {
      schema: getBarcodeTemplatesSchema,
      preHandler: requirePermission("barcode:read"),
    },
    async () => {
      const data = await fastify.repos.barcode.findAllTemplates();
      return { ok: true, data };
    },
  );

  fastify.post(
    "/templates",
    {
      schema: createBarcodeTemplateSchema,
      preHandler: requirePermission("barcode:create"),
    },
    async (request) => {
      const body = request.body as Omit<BarcodeTemplate, "id" | "createdAt">;

      let layoutJson: string | null | undefined;
      try {
        layoutJson = normalizeBarcodeLayoutJson(body.layoutJson);
      } catch (error) {
        throw fastify.httpErrors.badRequest(
          error instanceof Error ? error.message : "Invalid layoutJson",
        );
      }

      if (body.isDefault) {
        const templates = await fastify.repos.barcode.findAllTemplates();
        await Promise.all(
          templates
            .filter(
              (template) => template.isDefault && template.id !== undefined,
            )
            .map((template) =>
              fastify.repos.barcode.updateTemplate(template.id!, {
                isDefault: false,
              }),
            ),
        );
      }

      const data = await fastify.repos.barcode.createTemplate({
        ...body,
        layoutJson,
      });
      return { ok: true, data };
    },
  );

  fastify.get<{
    Querystring: {
      productId?: string;
      status?: "pending" | "printing" | "printed" | "failed";
      limit?: string;
      offset?: string;
    };
  }>(
    "/print-jobs",
    {
      schema: getBarcodePrintJobsSchema,
      preHandler: requirePermission("barcode:read"),
    },
    async (request) => {
      const query = request.query;
      const data = await fastify.repos.barcode.findPrintJobs({
        productId: query.productId ? parseInt(query.productId, 10) : undefined,
        status: query.status,
        limit: query.limit ? parseInt(query.limit, 10) : 25,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return { ok: true, data };
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/templates/:id",
    {
      schema: deleteBarcodeTemplateSchema,
      preHandler: requirePermission("barcode:delete"),
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      await fastify.repos.barcode.deleteTemplate(id);
      return { ok: true, data: null };
    },
  );
};

export default barcode;
