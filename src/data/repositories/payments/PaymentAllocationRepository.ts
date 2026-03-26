import { eq } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import type { TxOrDb } from "../../db/transaction.js";
import { paymentAllocations } from "../../schema/schema.js";
import type {
  IPaymentAllocationRepository,
  PaymentAllocation,
} from "../../../domain/index.js";

export class PaymentAllocationRepository implements IPaymentAllocationRepository {
  constructor(private db: DbConnection) {}

  private c(tx?: TxOrDb): TxOrDb {
    return tx ?? this.db;
  }

  async create(
    allocation: Omit<PaymentAllocation, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<PaymentAllocation> {
    const [created] = await this.c(tx)
      .insert(paymentAllocations)
      .values(allocation as any)
      .returning();
    return created as unknown as PaymentAllocation;
  }

  async findByPaymentId(
    paymentId: number,
    tx?: TxOrDb,
  ): Promise<PaymentAllocation[]> {
    const rows = await this.c(tx)
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, paymentId));
    return rows as unknown as PaymentAllocation[];
  }

  async findBySaleId(
    saleId: number,
    tx?: TxOrDb,
  ): Promise<PaymentAllocation[]> {
    const rows = await this.c(tx)
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.saleId, saleId));
    return rows as unknown as PaymentAllocation[];
  }
}
