import { IInventoryRepository } from '../../interfaces/IInventoryRepository.js';
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetInventoryDashboardUseCase extends ReadUseCase<void, { totalValuation: number; lowStockCount: number; expiryAlertCount: number; topMovingProducts: any[] }> {
  constructor(private inventoryRepository: IInventoryRepository) {
    super();
  }

  async execute(): Promise<{
    totalValuation: number;
    lowStockCount: number;
    expiryAlertCount: number;
    topMovingProducts: any[];
  }> {
    return this.inventoryRepository.getDashboardStats();
  }
}
