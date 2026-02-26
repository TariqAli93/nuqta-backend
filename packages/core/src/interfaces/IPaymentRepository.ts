import { Payment } from "../entities/Payment.js";

export interface IPaymentRepository {
  create(payment: Payment): Promise<Payment>;
  createSync(payment: Payment): Promise<Payment>;
  findByIdempotencyKey(key: string): Promise<Payment | null>;
  findBySaleId(saleId: number): Promise<Payment[]>;
  findByPurchaseId(purchaseId: number): Promise<Payment[]>;
  findByCustomerId(customerId: number): Promise<Payment[]>;
  findBySupplierId(supplierId: number): Promise<Payment[]>;
  delete(id: number): Promise<void>;
}
