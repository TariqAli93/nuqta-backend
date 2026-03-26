import type { PaymentAllocation } from "../entities/PaymentAllocation.js";
import type { TxOrDb } from "../../data/db/transaction.js";

export interface IPaymentAllocationRepository {
  create(
    allocation: Omit<PaymentAllocation, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<PaymentAllocation>;
  findByPaymentId(paymentId: number, tx?: TxOrDb): Promise<PaymentAllocation[]>;
  findBySaleId(saleId: number, tx?: TxOrDb): Promise<PaymentAllocation[]>;
}
