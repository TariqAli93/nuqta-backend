import { CustomerLedgerEntry } from "../entities/Ledger.js";

export interface ICustomerLedgerRepository {
  create(
    entry: Omit<CustomerLedgerEntry, "id" | "createdAt">,
  ): Promise<CustomerLedgerEntry>;
  createSync(
    entry: Omit<CustomerLedgerEntry, "id" | "createdAt">,
  ): Promise<CustomerLedgerEntry>;
  getLastBalanceSync(customerId: number): Promise<number>;
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
