import { IInventoryRepository } from '../../interfaces/IInventoryRepository.js';
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetExpiryAlertsUseCase extends ReadUseCase<{ daysAhead?: number } | void, any[]> {
  constructor(private inventoryRepository: IInventoryRepository) {
    super();
  }

  async execute(params?: { daysAhead?: number }): Promise<any[]> {
    return this.inventoryRepository.getExpiryAlerts(params?.daysAhead);
  }
}
