import { eq } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { payments } from "../schema/schema.js";
import { IPaymentRepository, Payment } from "@nuqta/core";

export class PaymentRepository implements IPaymentRepository {
  constructor(private db: DbConnection) {}

  async create(payment: Payment): Promise<Payment> {
    const [created] = await this.db
      .insert(payments)
      .values(payment as any)
      .returning();
    return created as unknown as Payment;
  }

  async createSync(payment: Payment): Promise<Payment> {
    return this.create(payment);
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    const [item] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.idempotencyKey, key));
    return (item as unknown as Payment) || null;
  }

  async findBySaleId(saleId: number): Promise<Payment[]> {
    const items = await this.db
      .select()
      .from(payments)
      .where(eq(payments.saleId, saleId));
    return items as unknown as Payment[];
  }

  async findByPurchaseId(purchaseId: number): Promise<Payment[]> {
    const items = await this.db
      .select()
      .from(payments)
      .where(eq(payments.purchaseId, purchaseId));
    return items as unknown as Payment[];
  }

  async findByCustomerId(customerId: number): Promise<Payment[]> {
    const items = await this.db
      .select()
      .from(payments)
      .where(eq(payments.customerId, customerId));
    return items as unknown as Payment[];
  }

  async findBySupplierId(supplierId: number): Promise<Payment[]> {
    const items = await this.db
      .select()
      .from(payments)
      .where(eq(payments.supplierId, supplierId));
    return items as unknown as Payment[];
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(payments).where(eq(payments.id, id));
  }
}
