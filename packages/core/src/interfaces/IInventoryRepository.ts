import { InventoryMovement } from "../entities/InventoryMovement.js";
import { Product } from "../entities/Product.js";

export interface IInventoryRepository {
  createMovement(
    movement: Omit<InventoryMovement, "id" | "createdAt">,
  ): Promise<InventoryMovement>;
  createMovementSync(
    movement: Omit<InventoryMovement, "id" | "createdAt">,
  ): Promise<InventoryMovement>;
  getMovements(params?: {
    productId?: number;
    movementType?: string;
    sourceType?: string;
    sourceId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: InventoryMovement[]; total: number }>;
  getDashboardStats(): Promise<{
    totalValuation: number;
    lowStockCount: number;
    expiryAlertCount: number;
    topMovingProducts: any[];
  }>;
  getExpiryAlerts(): Promise<any[]>;
}
