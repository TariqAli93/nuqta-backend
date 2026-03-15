import { FastifyPluginAsync } from "fastify";
import { GetSaleReceiptUseCase } from "../../../domain/index.js";
import {
  ErrorResponses,
  successEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";
import { SaleReceiptSchema } from "../../../schemas/sale-receipt.js";

const AfterPayBodySchema = {
  type: "object" as const,
  required: ["saleId"],
  properties: {
    saleId: { type: "integer", minimum: 1 },
    printerName: { type: "string" },
  },
  additionalProperties: false,
} as const;

export const afterPaySchema = {
  tags: ["POS"],
  summary: "Post-sale hook: generate structured receipt data for printing",
  security: [{ bearerAuth: [] }],
  body: AfterPayBodySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        required: ["saleId", "receipt", "printerName"],
        properties: {
          saleId: { type: "integer" },
          receipt: SaleReceiptSchema,
          printerName: { type: "string", nullable: true },
        },
        additionalProperties: false,
      },
      "Receipt data generated",
    ),
    ...ErrorResponses,
  },
} as const;

const pos: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /pos/after-pay
  fastify.post(
    "/after-pay",
    {
      schema: afterPaySchema,
      preHandler: requirePermission("sales:read"),
    },
    async (request) => {
      const { saleId, printerName } = request.body as {
        saleId: number;
        printerName?: string;
      };

      const receiptUc = new GetSaleReceiptUseCase(fastify.repos.sale);
      const receipt = await receiptUc.execute(saleId);

      return {
        ok: true,
        data: {
          saleId,
          receipt,
          printerName: printerName || null,
        },
      };
    },
  );
};

export default pos;
