/**
 * GetProductSalesHistoryUseCase
 * Returns paginated sales history for a product.
 */

import { IProductWorkspaceRepository } from "../../interfaces/IProductWorkspaceRepository.js";
import { SalesHistoryItem } from "../../entities/ProductHistory.js";

export class GetProductSalesHistoryUseCase {
  constructor(private repo: IProductWorkspaceRepository) {}

  async execute(
    productId: number,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{ items: SalesHistoryItem[] }> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const items = await this.repo.getSalesHistory(productId, limit, offset);
    return { items };
  }
}
