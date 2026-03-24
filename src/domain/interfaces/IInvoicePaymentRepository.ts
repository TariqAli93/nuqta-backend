import type {
  SalesInvoicePayment,
  PurchaseInvoicePayment,
} from "../entities/InvoicePayment.js";
import type { TxOrDb } from "../../data/db/transaction.js";

export interface ISalesInvoicePaymentRepository {
  create(
    payment: Omit<SalesInvoicePayment, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<SalesInvoicePayment>;
  findByInvoiceId(invoiceId: number): Promise<SalesInvoicePayment[]>;
}

export interface IPurchaseInvoicePaymentRepository {
  create(
    payment: Omit<PurchaseInvoicePayment, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<PurchaseInvoicePayment>;
  findByInvoiceId(invoiceId: number): Promise<PurchaseInvoicePayment[]>;
}
