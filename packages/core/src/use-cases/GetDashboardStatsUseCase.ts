import { ISaleRepository } from '../interfaces/ISaleRepository.js';
import { IProductRepository } from '../interfaces/IProductRepository.js';

export class GetDashboardStatsUseCase {
  constructor(
    private saleRepo: ISaleRepository,
    private productRepo: IProductRepository
  ) {}

  async execute() {
    const today = new Date();

    // Parallelize queries for performance
    const [salesToday, salesMonth, lowStockCount, topProducts] = await Promise.all([
      // 1. Daily Sales Summary (Today)
      this.saleRepo.getDailySummary(today),

      // 2. Monthly Sales (Optional for now, but good to have)
      // For now, let's just stick to daily as per plan, or maybe add month later.
      // Actually plan said "salesMonth", but repository doesn't have it yet.
      // Let's stick to what we defined in ISaleRepository for now (Daily).
      Promise.resolve(null),

      // 3. Low Stock Alert Count
      this.productRepo.countLowStock(5), // Default threshold 5 (TODO: Make configurable)

      // 4. Top Selling Products
      this.saleRepo.getTopSelling(5),
    ]);

    return {
      salesToday,
      lowStockCount,
      topProducts,
    };
  }
}
