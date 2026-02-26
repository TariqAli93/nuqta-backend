import { Sale, SaleItemDepletion } from "../entities/Sale.js";

export interface ISaleRepository {
  create(sale: Sale): Promise<Sale>;
  findById(id: number): Promise<Sale | null>;
  findByIdempotencyKey(key: string): Promise<Sale | null>;
  findAll(params?: {
    page: number;
    limit: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    items: Sale[];
    total: number;
  }>;
  updateStatus(id: number, status: "completed" | "cancelled"): Promise<void>;
  update(id: number, data: Partial<Sale>): Promise<void>;
  createItemDepletions(
    depletions: Omit<
      SaleItemDepletion,
      "id" | "createdAt" | "batchNumber" | "expiryDate"
    >[],
  ): Promise<void>;
  getItemDepletionsBySaleId(saleId: number): Promise<SaleItemDepletion[]>;
  getDailySummary(date: Date): Promise<{
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

  generateReceipt(saleId: number): Promise<string>;
}
