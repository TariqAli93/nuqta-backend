import { CustomerLedgerEntry } from "../entities/Ledger.js";
import type { TxOrDb } from "../../data/db/transaction.js";

export interface ICustomerLedgerRepository {
  create(
    entry: Omit<CustomerLedgerEntry, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<CustomerLedgerEntry>;
  createSync(
    entry: Omit<CustomerLedgerEntry, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<CustomerLedgerEntry>;
  getLastBalanceSync(customerId: number, tx?: TxOrDb): Promise<number>;
  findByPaymentIdSync(paymentId: number): Promise<CustomerLedgerEntry | null>;
  findAll(params: {
    customerId: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CustomerLedgerEntry[]; total: number }>;
  getBalance(customerId: number): Promise<number>;
}
