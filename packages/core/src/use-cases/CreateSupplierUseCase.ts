import { Supplier } from '../entities/Supplier.js';
import { ISupplierRepository } from '../interfaces/ISupplierRepository.js';

export class CreateSupplierUseCase {
  constructor(private supplierRepository: ISupplierRepository) {}

  async execute(
    data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'totalPayable'>
  ): Promise<Supplier> {
    return this.supplierRepository.create(data);
  }
}
