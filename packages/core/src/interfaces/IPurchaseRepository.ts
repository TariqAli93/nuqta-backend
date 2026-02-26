import { Purchase } from "../entities/Purchase.js";

export interface IPurchaseRepository {
  create(purchase: Purchase): Promise<Purchase>;
  createSync(purchase: Purchase): Promise<Purchase>;
  findByIdempotencyKey(key: string): Promise<Purchase | null>;
  findAll(params?: {
    search?: string;
    supplierId?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Purchase[]; total: number }>;
  findById(id: number): Promise<Purchase | null>;
  findByIdSync?(id: number): Promise<Purchase | null>;
  updateStatus(id: number, status: string): Promise<void>;
  updateStatusSync?(id: number, status: string): Promise<void>;
  updatePayment(
    id: number,
    paidAmount: number,
    remainingAmount: number,
  ): Promise<void>;
  updatePaymentSync?(
    id: number,
    paidAmount: number,
    remainingAmount: number,
  ): Promise<void>;
}
