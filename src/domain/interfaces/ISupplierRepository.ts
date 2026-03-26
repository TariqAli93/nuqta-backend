import { Supplier } from "../entities/Supplier.js";
import type { TxOrDb } from "../../data/db/transaction.js";

export interface ISupplierRepository {
  findAll(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Supplier[]; total: number }>;
  findByIdSync(id: number): Promise<Supplier | null>;
  findById(id: number): Promise<Supplier | null>;
  create(
    supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">,
  ): Promise<Supplier>;
  update(id: number, supplier: Partial<Supplier>): Promise<Supplier>;
  delete(id: number): Promise<void>;
  /**
   * Atomically adjusts supplier.currentBalance by amountChange (delta).
   * Pass tx to execute inside an existing database transaction.
   */
  updatePayable(id: number, amountChange: number, tx?: TxOrDb): Promise<void>;
}
