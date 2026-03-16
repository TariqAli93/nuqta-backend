/**
 * GetProductSalesHistoryUseCase
 * Returns paginated sales history for a product.
 */

import { IProductWorkspaceRepository } from "../../interfaces/IProductWorkspaceRepository.js";
import { SalesHistoryItem } from "../../entities/ProductHistory.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetProductSalesHistoryUseCase extends ReadUseCase<
  { productId: number; opts?: { limit?: number; offset?: number } },
  { items: SalesHistoryItem[] }
> {
  constructor(private repo: IProductWorkspaceRepository) {
    super();
  }

  async execute(
    input: { productId: number; opts?: { limit?: number; offset?: number } },
    _userId: string,
  ): Promise<{ items: SalesHistoryItem[] }> {
    const limit = input.opts?.limit ?? 50;
    const offset = input.opts?.offset ?? 0;
    const items = await this.repo.getSalesHistory(
      input.productId,
      limit,
      offset,
    );
    return { items };
  }
}
