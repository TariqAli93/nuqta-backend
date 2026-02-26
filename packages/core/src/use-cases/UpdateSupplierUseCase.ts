import { Supplier } from '../entities/Supplier.js';
import { ISupplierRepository } from '../interfaces/ISupplierRepository.js';

export class UpdateSupplierUseCase {
  constructor(private supplierRepository: ISupplierRepository) {}

  async execute(id: number, data: Partial<Supplier>): Promise<Supplier> {
    return this.supplierRepository.update(id, data);
  }
}
