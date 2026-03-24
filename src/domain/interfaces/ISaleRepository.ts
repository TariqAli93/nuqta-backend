import { Sale, SaleItemDepletion } from "../entities/Sale.js";
import { SaleReceipt } from "../entities/SaleReceipt.js";
import type { TxOrDb } from "../../data/db/transaction.js";

export interface ISaleRepository {
  create(sale: Sale, tx?: TxOrDb): Promise<Sale>;
  findById(id: number, tx?: TxOrDb): Promise<Sale | null>;
  findByIdempotencyKey(key: string): Promise<Sale | null>;
  findAll(params?: {
    page: number;
    limit: number;
    customerId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    items: Sale[];
    total: number;
  }>;
  updateStatus(
    id: number,
    status: "completed" | "cancelled" | "refunded" | "partial_refund",
    tx?: TxOrDb,
  ): Promise<void>;
  update(id: number, data: Partial<Sale>, tx?: TxOrDb): Promise<void>;
  createItemDepletions(
    depletions: Omit<
      SaleItemDepletion,
      "id" | "createdAt" | "batchNumber" | "expiryDate"
    >[],
    tx?: TxOrDb,
  ): Promise<void>;
  getItemDepletionsBySaleId(
    saleId: number,
    tx?: TxOrDb,
  ): Promise<SaleItemDepletion[]>;
  /**
   * Atomically adds `addedQtyBase` to `sale_items.returned_quantity_base` for a single
   * line item. Called inside the refund transaction to prevent over-return across
   * multiple partial refunds.
   */
  incrementItemReturnedQty(
    saleItemId: number,
    addedQtyBase: number,
    tx?: TxOrDb,
  ): Promise<void>;
  getDailySummary(date: Date): Promise<{
    revenue: number;
    count: number;
    cash: number;
    card: number;
    transfer: number;
  }>;
  getMonthlySummary(date: Date): Promise<{
    revenue: number;
    count: number;
    cash: number;
    card: number;
    transfer: number;
  }>;

  getTopSelling(limit: number): Promise<
    {
      productId: number;
      productName: string;
      quantity: number;
      revenue: number;
    }[]
  >;

  getReceiptData(saleId: number): Promise<SaleReceipt | null>;
}
