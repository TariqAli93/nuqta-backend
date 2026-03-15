import { Supplier } from '../../entities/Supplier.js';
import { ISupplierRepository } from '../../interfaces/ISupplierRepository.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'totalPayable'>;

export class CreateSupplierUseCase extends WriteUseCase<TInput, Supplier, Supplier> {
  constructor(private supplierRepository: ISupplierRepository) {
    super();
  }

  async executeCommitPhase(
    data: TInput,
    _userId: string,
  ): Promise<Supplier> {
    return this.supplierRepository.create(data);
  }

  executeSideEffectsPhase(_result: Supplier, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Supplier): Supplier {
    return result;
  }
}
