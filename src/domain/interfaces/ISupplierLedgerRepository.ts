import { SupplierLedgerEntry } from "../entities/Ledger.js";

export interface ISupplierLedgerRepository {
  create(
    entry: Omit<SupplierLedgerEntry, "id" | "createdAt">,
  ): Promise<SupplierLedgerEntry>;
  createSync(
    entry: Omit<SupplierLedgerEntry, "id" | "createdAt">,
  ): Promise<SupplierLedgerEntry>;
  getLastBalanceSync(supplierId: number): Promise<number>;
  findByPaymentIdSync(paymentId: number): Promise<SupplierLedgerEntry | null>;
  findAll(params: {
    supplierId: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SupplierLedgerEntry[]; total: number }>;
  getBalance(supplierId: number): Promise<number>;
}
