import { sql } from "drizzle-orm";
import { DbConnection } from "../db.js";

/**
 * Repository for product workspace data — uses raw SQL for complex
 * cross-table lookup queries (purchase history, sales history, etc.).
 */
export class ProductWorkspaceRepository {
  constructor(private db: DbConnection) {}

  async getPurchaseHistory(productId: number, limit = 20): Promise<any[]> {
    const rows = await this.db.execute(
      sql.raw(`
      SELECT
        pi.id,
        pi.purchase_id AS "purchaseId",
        p.invoice_number AS "invoiceNumber",
        pi.quantity,
        pi.unit_name AS "unitName",
        pi.unit_factor AS "unitFactor",
        pi.quantity_base AS "quantityBase",
        pi.unit_cost AS "unitCost",
        pi.line_subtotal AS "lineSubtotal",
        pi.batch_id AS "batchId",
        pi.expiry_date AS "expiryDate",
        pi.created_at AS "createdAt",
        s.name AS "supplierName"
      FROM purchase_items pi
      JOIN purchases p ON p.id = pi.purchase_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE pi.product_id = ${productId}
      ORDER BY pi.created_at DESC
      LIMIT ${limit}
    `),
    );
    return rows as any[];
  }

  async getSalesHistory(productId: number, limit = 20): Promise<any[]> {
    const rows = await this.db.execute(
      sql.raw(`
      SELECT
        si.id,
        si.sale_id AS "saleId",
        s.invoice_number AS "invoiceNumber",
        si.quantity,
        si.unit_name AS "unitName",
        si.unit_factor AS "unitFactor",
        si.quantity_base AS "quantityBase",
        si.unit_price AS "unitPrice",
        si.subtotal,
        si.created_at AS "createdAt",
        c.name AS "customerName"
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE si.product_id = ${productId}
      ORDER BY si.created_at DESC
      LIMIT ${limit}
    `),
    );
    return rows as any[];
  }

  async getBatchMovements(batchId: number, limit = 50): Promise<any[]> {
    const rows = await this.db.execute(
      sql.raw(`
      SELECT
        im.id,
        im.movement_type AS "movementType",
        im.reason,
        im.quantity_base AS "quantityBase",
        im.unit_name AS "unitName",
        im.unit_factor AS "unitFactor",
        im.stock_before AS "stockBefore",
        im.stock_after AS "stockAfter",
        im.cost_per_unit AS "costPerUnit",
        im.total_cost AS "totalCost",
        im.source_type AS "sourceType",
        im.source_id AS "sourceId",
        im.notes,
        im.created_at AS "createdAt",
        im.created_by AS "createdBy"
      FROM inventory_movements im
      WHERE im.batch_id = ${batchId}
      ORDER BY im.created_at DESC
      LIMIT ${limit}
    `),
    );
    return rows as any[];
  }

  async getProductSummary(productId: number): Promise<{
    totalPurchased: number;
    totalSold: number;
    totalCogs: number;
    totalRevenue: number;
    activeBatches: number;
    averageCost: number;
  }> {
    const [purchaseRow] = (await this.db.execute(
      sql.raw(`
      SELECT
        COALESCE(SUM(pi.quantity_base), 0) AS "totalPurchased"
      FROM purchase_items pi
      WHERE pi.product_id = ${productId}
    `),
    )) as any[];

    const [salesRow] = (await this.db.execute(
      sql.raw(`
      SELECT
        COALESCE(SUM(si.quantity_base), 0) AS "totalSold",
        COALESCE(SUM(si.subtotal), 0) AS "totalRevenue"
      FROM sale_items si
      WHERE si.product_id = ${productId}
    `),
    )) as any[];

    const [cogsRow] = (await this.db.execute(
      sql.raw(`
      SELECT
        COALESCE(SUM(sid.total_cost), 0) AS "totalCogs"
      FROM sale_item_depletions sid
      WHERE sid.product_id = ${productId}
    `),
    )) as any[];

    const [batchRow] = (await this.db.execute(
      sql.raw(`
      SELECT
        COUNT(*) AS "activeBatches",
        CASE WHEN SUM(quantity_on_hand) > 0
          THEN ROUND(SUM(cost_per_unit * quantity_on_hand)::numeric / SUM(quantity_on_hand))
          ELSE 0
        END AS "averageCost"
      FROM product_batches
      WHERE product_id = ${productId}
        AND status = 'active'
        AND quantity_on_hand > 0
    `),
    )) as any[];

    return {
      totalPurchased: Number(purchaseRow?.totalPurchased ?? 0),
      totalSold: Number(salesRow?.totalSold ?? 0),
      totalCogs: Number(cogsRow?.totalCogs ?? 0),
      totalRevenue: Number(salesRow?.totalRevenue ?? 0),
      activeBatches: Number(batchRow?.activeBatches ?? 0),
      averageCost: Number(batchRow?.averageCost ?? 0),
    };
  }
}
