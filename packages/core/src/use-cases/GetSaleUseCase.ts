import { ISaleRepository } from "../interfaces/ISaleRepository.js";
import { Sale } from "../entities/Sale.js";

export class GetSaleUseCase {
  constructor(private saleRepo: ISaleRepository) {}

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
