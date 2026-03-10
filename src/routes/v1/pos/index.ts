import { FastifyPluginAsync } from "fastify";
import { GetSaleReceiptUseCase } from "@nuqta/core";
import {
  ErrorResponses,
  successEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

const AfterPayBodySchema = {
  type: "object" as const,
  required: ["saleId"],
  properties: {
    saleId: { type: "integer", minimum: 1 },
    printerName: { type: "string" },
  },
  additionalProperties: false,
} as const;

const afterPaySchema = {
  tags: ["POS"],
  summary: "Post-sale hook: generate receipt for printing",
  security: [{ bearerAuth: [] }],
  body: AfterPayBodySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          saleId: { type: "integer" },
          receipt: { type: "string" },
          printerName: { type: "string", nullable: true },
        },
      },
      "Receipt generated",
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
