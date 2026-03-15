import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { Sale } from "../../entities/Sale.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetSaleUseCase extends ReadUseCase<{ page?: number; limit?: number; startDate?: string; endDate?: string }, Sale | null> {
  constructor(private saleRepo: ISaleRepository) {
    super();
  }

  async execute(params: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<Sale | null> {
    const result = await this.saleRepo.findAll({
      page: params.page || 1,
      limit: params.limit || 10,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    if (result.items.length > 0) {
      return result.items[0];
    }

    return null;
  }
}
