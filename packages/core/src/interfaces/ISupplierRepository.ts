import { Supplier } from "../entities/Supplier.js";

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
  updatePayable(id: number, amountChange: number): Promise<void>;
}
