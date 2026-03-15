/**
 * CancelSaleUseCase
 * Cancels a sale if it is not already cancelled.
 */
import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { saleId: number };

export class CancelSaleUseCase extends WriteUseCase<TInput, void, void> {
  constructor(private saleRepo: ISaleRepository) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<void> {
    const sale = await this.saleRepo.findById(input.saleId);
    if (!sale) {
      throw new NotFoundError("الفاتورة غير موجودة");
    }

    if (sale.status === "cancelled") {
      throw new InvalidStateError("الفاتورة ملغية بالفعل");
    }

    await this.saleRepo.updateStatus(input.saleId, "cancelled");
  }

  executeSideEffectsPhase(_r: void, _u: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: void): void {
    return result;
  }
}
