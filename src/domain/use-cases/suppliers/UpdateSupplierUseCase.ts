import { Supplier } from '../../entities/Supplier.js';
import { ISupplierRepository } from '../../interfaces/ISupplierRepository.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { id: number; data: Partial<Supplier> };

export class UpdateSupplierUseCase extends WriteUseCase<TInput, Supplier, Supplier> {
  constructor(private supplierRepository: ISupplierRepository) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<Supplier> {
    return this.supplierRepository.update(input.id, input.data);
  }

  executeSideEffectsPhase(_result: Supplier, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Supplier): Supplier {
    return result;
  }
}
