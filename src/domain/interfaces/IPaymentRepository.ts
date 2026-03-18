import { Payment } from "../entities/Payment.js";
import type { TxOrDb } from "../../data/db/transaction.js";

export interface IPaymentRepository {
  create(payment: Payment, tx?: TxOrDb): Promise<Payment>;
  createSync(payment: Payment, tx?: TxOrDb): Promise<Payment>;
  findByIdempotencyKey(key: string): Promise<Payment | null>;
  findBySaleId(saleId: number): Promise<Payment[]>;
  findByPurchaseId(purchaseId: number): Promise<Payment[]>;
  findByCustomerId(customerId: number): Promise<Payment[]>;
  findBySupplierId(supplierId: number): Promise<Payment[]>;
  delete(id: number): Promise<void>;

  /** Mark all payments for a sale as 'voided' within a transaction. */
  voidBySaleId(saleId: number, tx?: TxOrDb): Promise<void>;
}
