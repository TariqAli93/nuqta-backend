import { eq, sql } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import type { TxOrDb } from "../../db/transaction.js";
import { payments } from "../../schema/schema.js";
import { IPaymentRepository, Payment } from "../../../domain/index.js";

export class PaymentRepository implements IPaymentRepository {
  constructor(private db: DbConnection) {}

  private c(tx?: TxOrDb): TxOrDb {
    return tx ?? this.db;
  }

  async create(payment: Payment, tx?: TxOrDb): Promise<Payment> {
    const [created] = await this.c(tx)
      .insert(payments)
      .values(payment as any)
      .returning();
    return created as unknown as Payment;
  }

  async createSync(payment: Payment, tx?: TxOrDb): Promise<Payment> {
    return this.create(payment, tx);
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

  async voidBySaleId(saleId: number, tx?: TxOrDb): Promise<void> {
    await this.c(tx)
      .update(payments)
      .set({ status: "voided" } as any)
      .where(eq(payments.saleId, saleId));
  }
}
