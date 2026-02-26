import { Supplier } from '../entities/Supplier.js';
import { ISupplierRepository } from '../interfaces/ISupplierRepository.js';

export class GetSupplierByIdUseCase {
  constructor(private supplierRepository: ISupplierRepository) {}

  async execute(id: number): Promise<Supplier | null> {
    return this.supplierRepository.findById(id);
  }
}
