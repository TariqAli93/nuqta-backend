/**
 * CancelSaleUseCase
 * Cancels a sale if it is not already cancelled.
 */
import { ISaleRepository } from "../interfaces/ISaleRepository.js";
import { NotFoundError, InvalidStateError } from "../errors/DomainErrors.js";

export class CancelSaleUseCase {
  constructor(private saleRepo: ISaleRepository) {}

  async execute(saleId: number, userId: number): Promise<void> {
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) {
      throw new NotFoundError("الفاتورة غير موجودة");
    }

    if (sale.status === "cancelled") {
      throw new InvalidStateError("الفاتورة ملغية بالفعل");
    }

    await this.saleRepo.updateStatus(saleId, "cancelled");
  }
}
