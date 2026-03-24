import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { IProductRepository } from "../../interfaces/IProductRepository.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetDashboardStatsUseCase extends ReadUseCase<void, any> {
  constructor(
    private saleRepo: ISaleRepository,
    private productRepo: IProductRepository,
  ) {
    super();
  }

  async execute() {
    const today = new Date();

    // Parallelize queries for performance
    const [salesToday, salesMonth, lowStockCount, topProducts] =
      await Promise.all([
        // 1. Daily Sales Summary (Today)
        this.saleRepo.getDailySummary(today),

        // 2. Monthly Sales (Optional for now, but good to have)
        this.saleRepo.getMonthlySummary(today),

        Promise.resolve(),

        // 3. Low Stock Alert Count
        this.productRepo.countLowStock(5), // Default threshold 5 (TODO: Make configurable)

        // 4. Top Selling Products
        this.saleRepo.getTopSelling(5),
      ]);

    return {
      salesToday,
      lowStockCount,
      topProducts,
      salesMonth,
    };
  }
}
