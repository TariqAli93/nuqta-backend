/**
 * GetProductPurchaseHistoryUseCase
 * Returns paginated purchase history for a product.
 */

import { IProductWorkspaceRepository } from "../../interfaces/IProductWorkspaceRepository.js";
import { PurchaseHistoryItem } from "../../entities/ProductHistory.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetProductPurchaseHistoryUseCase extends ReadUseCase<
  { productId: number; opts?: { limit?: number; offset?: number } },
  { items: PurchaseHistoryItem[] }
> {
  constructor(private repo: IProductWorkspaceRepository) {
    super();
  }

  async execute(
    input: { productId: number; opts?: { limit?: number; offset?: number } },
    _userId: string,
  ): Promise<{ items: PurchaseHistoryItem[] }> {
    const { productId, opts = {} } = input;
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const items = await this.repo.getPurchaseHistory(productId, limit, offset);
    return { items };
  }
}
