import { IInventoryRepository } from '../interfaces/IInventoryRepository.js';
import { InventoryMovement } from '../entities/InventoryMovement.js';

export class GetInventoryMovementsUseCase {
  constructor(private inventoryRepository: IInventoryRepository) {}

  async execute(params?: {
    productId?: number;
    movementType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: InventoryMovement[]; total: number }> {
    return this.inventoryRepository.getMovements(params);
  }
}
