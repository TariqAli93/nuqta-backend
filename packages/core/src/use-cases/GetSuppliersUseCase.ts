import { Supplier } from '../entities/Supplier.js';
import { ISupplierRepository } from '../interfaces/ISupplierRepository.js';

export class GetSuppliersUseCase {
  constructor(private supplierRepository: ISupplierRepository) {}

  async execute(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Supplier[]; total: number }> {
    return this.supplierRepository.findAll(params);
  }
}
