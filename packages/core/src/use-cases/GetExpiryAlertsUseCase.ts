import { IInventoryRepository } from '../interfaces/IInventoryRepository.js';

export class GetExpiryAlertsUseCase {
  constructor(private inventoryRepository: IInventoryRepository) {}

  async execute(): Promise<any[]> {
    return this.inventoryRepository.getExpiryAlerts();
  }
}
