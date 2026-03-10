/**
 * GetSaleReceiptUseCase
 * Generates a receipt string for a sale.
 */
import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";

export class GetSaleReceiptUseCase {
  constructor(private saleRepo: ISaleRepository) {}

  async execute(saleId: number): Promise<string> {
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) {
      throw new NotFoundError("الفاتورة غير موجودة");
    }

    return this.saleRepo.generateReceipt(saleId);
  }
}
