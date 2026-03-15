/**
 * GetSaleReceiptUseCase
 * Returns structured receipt data for a sale.
 */
import { SaleReceipt } from "../../entities/SaleReceipt.js";
import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetSaleReceiptUseCase extends ReadUseCase<number, SaleReceipt> {
  constructor(private saleRepo: ISaleRepository) {
    super();
  }

  async execute(saleId: number): Promise<SaleReceipt> {
    const receipt = await this.saleRepo.getReceiptData(saleId);
    if (!receipt) {
      throw new NotFoundError("الفاتورة غير موجودة");
    }

    return receipt;
  }
}
