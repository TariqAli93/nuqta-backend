import { ISupplierRepository } from '../interfaces/ISupplierRepository.js';

export class DeleteSupplierUseCase {
  constructor(private supplierRepository: ISupplierRepository) {}

  async execute(id: number): Promise<void> {
    return this.supplierRepository.delete(id);
  }
}
