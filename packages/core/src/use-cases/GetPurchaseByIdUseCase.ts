import { Purchase } from '../entities/Purchase.js';
import { IPurchaseRepository } from '../interfaces/IPurchaseRepository.js';

export class GetPurchaseByIdUseCase {
  constructor(private purchaseRepository: IPurchaseRepository) {}

  async execute(id: number): Promise<Purchase | null> {
    return this.purchaseRepository.findById(id);
  }
}
