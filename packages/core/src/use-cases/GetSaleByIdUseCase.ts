import { ISaleRepository } from '../interfaces/ISaleRepository.js';
import { Sale } from '../entities/Sale.js';

export class GetSaleByIdUseCase {
  constructor(private saleRepo: ISaleRepository) {}

  async execute(id: number): Promise<Sale | null> {
    const sale = this.saleRepo.findById(id);
    return sale || null;
  }
}
