import { IInventoryRepository } from '../../interfaces/IInventoryRepository.js';
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetExpiryAlertsUseCase extends ReadUseCase<void, any[]> {
  constructor(private inventoryRepository: IInventoryRepository) {
    super();
  }

  async execute(): Promise<any[]> {
    return this.inventoryRepository.getExpiryAlerts();
  }
}
