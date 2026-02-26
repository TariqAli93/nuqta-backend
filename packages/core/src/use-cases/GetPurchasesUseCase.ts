import { Purchase } from '../entities/Purchase.js';
import { IPurchaseRepository } from '../interfaces/IPurchaseRepository.js';

export class GetPurchasesUseCase {
  constructor(private purchaseRepository: IPurchaseRepository) {}

  async execute(params?: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Purchase[]; total: number }> {
    return this.purchaseRepository.findAll(params);
  }
}
