import { SupplierLedgerEntry } from "../entities/Ledger.js";
import type { TxOrDb } from "../../data/db/transaction.js";

export interface ISupplierLedgerRepository {
  create(
    entry: Omit<SupplierLedgerEntry, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<SupplierLedgerEntry>;
  createSync(
    entry: Omit<SupplierLedgerEntry, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<SupplierLedgerEntry>;
  getLastBalanceSync(supplierId: number, tx?: TxOrDb): Promise<number>;
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
