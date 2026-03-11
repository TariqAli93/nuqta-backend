import { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../../../middleware/rbac.js";

const ReportQuerySchema = {
  type: "object" as const,
  properties: {
    format: {
      type: "string",
      enum: ["csv", "json"],
      default: "csv",
      description: "Export format",
    },
    dateFrom: {
      type: "string",
      format: "date",
      description: "Start date filter",
    },
    dateTo: {
      type: "string",
      format: "date",
      description: "End date filter",
    },
  },
} as const;

function toCsv(
  headers: string[],
  rows: Record<string, unknown>[],
): string {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        // Escape commas and quotes in CSV
        return str.includes(",") || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(","),
  );
  // Add BOM for Excel Arabic support
  return "\uFEFF" + [headerLine, ...dataLines].join("\n");
}

const reports: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /reports/sales
  fastify.get(
    "/sales",
    {
      schema: {
        tags: ["Reports"],
        summary: "Export sales report",
        security: [{ bearerAuth: [] }],
        querystring: ReportQuerySchema,
      },
      preHandler: requirePermission("sales:read"),
    },
    async (request, reply) => {
      const query = request.query as {
        format?: string;
        dateFrom?: string;
        dateTo?: string;
      };

      const result = await fastify.repos.sale.findAll({
        page: 1,
        limit: 10000,
        startDate: query.dateFrom,
        endDate: query.dateTo,
      });

      const items = result.items as Array<Record<string, unknown>>;

      if (query.format === "json") {
        return reply.send({ ok: true, data: items });
      }

      // CSV export
      const headers = [
        "id",
        "invoiceNumber",
        "total",
        "paidAmount",
        "remainingAmount",
        "paymentType",
        "status",
        "createdAt",
      ];
      const csv = toCsv(headers, items);

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="sales-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        )
        .send(csv);
    },
  );

  // GET /reports/inventory
  fastify.get(
    "/inventory",
    {
      schema: {
        tags: ["Reports"],
        summary: "Export inventory report",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object" as const,
          properties: {
            format: {
              type: "string",
              enum: ["csv", "json"],
              default: "csv",
            },
          },
        },
      },
      preHandler: requirePermission("inventory:read"),
    },
    async (request, reply) => {
      const query = request.query as { format?: string };

      const result = await fastify.repos.product.findAll({
        limit: 10000,
      });

      const items = result.items as Array<Record<string, unknown>>;

      if (query.format === "json") {
        return reply.send({ ok: true, data: items });
      }

      const headers = [
        "id",
        "name",
        "sku",
        "stock",
        "minStock",
        "costPrice",
        "salePrice",
        "categoryId",
      ];
      const csv = toCsv(headers, items);

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="inventory-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        )
        .send(csv);
    },
  );
};

export default reports;
