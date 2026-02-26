import { IInventoryRepository } from '../interfaces/IInventoryRepository.js';

export class GetInventoryDashboardUseCase {
  constructor(private inventoryRepository: IInventoryRepository) {}

  async execute(): Promise<{
    totalValuation: number;
    lowStockCount: number;
    expiryAlertCount: number;
    topMovingProducts: any[];
  }> {
    return this.inventoryRepository.getDashboardStats();
  }
}
