import type {
  PurchaseHistoryItem,
  SalesHistoryItem,
} from "../entities/ProductHistory.js";

export interface IProductWorkspaceRepository {
  getPurchaseHistory(
    productId: number,
    limit: number,
    offset: number,
  ): Promise<PurchaseHistoryItem[]>;

  getSalesHistory(
    productId: number,
    limit: number,
    offset: number,
  ): Promise<SalesHistoryItem[]>;
}
