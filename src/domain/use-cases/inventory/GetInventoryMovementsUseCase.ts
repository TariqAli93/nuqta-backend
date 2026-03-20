import { IInventoryRepository } from '../../interfaces/IInventoryRepository.js';
import { InventoryMovement } from '../../entities/InventoryMovement.js';
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetInventoryMovementsUseCase extends ReadUseCase<{ productId?: number; movementType?: string; sourceType?: string; sourceId?: number; dateFrom?: string; dateTo?: string; limit?: number; offset?: number } | undefined, { items: InventoryMovement[]; total: number }> {
  constructor(private inventoryRepository: IInventoryRepository) {
    super();
  }

  async execute(params?: {
    productId?: number;
    movementType?: string;
    sourceType?: string;
    sourceId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: InventoryMovement[]; total: number }> {
    return this.inventoryRepository.getMovements(params);
  }
}
