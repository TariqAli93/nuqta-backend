import { eq } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import type { TxOrDb } from "../../db/transaction.js";
import {
  salesInvoicePayments,
  purchaseInvoicePayments,
} from "../../schema/schema.js";
import type {
  ISalesInvoicePaymentRepository,
  IPurchaseInvoicePaymentRepository,
} from "../../../domain/index.js";
import type {
  SalesInvoicePayment,
  PurchaseInvoicePayment,
} from "../../../domain/index.js";

export class SalesInvoicePaymentRepository
  implements ISalesInvoicePaymentRepository
{
  constructor(private db: DbConnection) {}

  private c(tx?: TxOrDb): TxOrDb {
    return tx ?? this.db;
  }

  async create(
    payment: Omit<SalesInvoicePayment, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<SalesInvoicePayment> {
    const [created] = await this.c(tx)
      .insert(salesInvoicePayments)
      .values(payment as any)
      .returning();
    return created as unknown as SalesInvoicePayment;
  }

  async findByInvoiceId(invoiceId: number): Promise<SalesInvoicePayment[]> {
    const rows = await this.db
      .select()
      .from(salesInvoicePayments)
      .where(eq(salesInvoicePayments.invoiceId, invoiceId));
    return rows as unknown as SalesInvoicePayment[];
  }
}

export class PurchaseInvoicePaymentRepository
  implements IPurchaseInvoicePaymentRepository
{
  constructor(private db: DbConnection) {}

  private c(tx?: TxOrDb): TxOrDb {
    return tx ?? this.db;
  }

  async create(
    payment: Omit<PurchaseInvoicePayment, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<PurchaseInvoicePayment> {
    const [created] = await this.c(tx)
      .insert(purchaseInvoicePayments)
      .values(payment as any)
      .returning();
    return created as unknown as PurchaseInvoicePayment;
  }

  async findByInvoiceId(invoiceId: number): Promise<PurchaseInvoicePayment[]> {
    const rows = await this.db
      .select()
      .from(purchaseInvoicePayments)
      .where(eq(purchaseInvoicePayments.invoiceId, invoiceId));
    return rows as unknown as PurchaseInvoicePayment[];
  }
}
