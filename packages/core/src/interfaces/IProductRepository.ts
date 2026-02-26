import { Product } from "../entities/Product.js";
import { ProductBatch } from "../entities/ProductBatch.js";
import { ProductUnit } from "../entities/ProductUnit.js";

export interface IProductRepository {
  findAll(params?: {
    search?: string;
    limit?: number;
    offset?: number;
    categoryId?: number;
    supplierId?: number;
    status?: string;
    lowStockOnly?: boolean;
    expiringSoonOnly?: boolean;
  }): Promise<{ items: Product[]; total: number }>;
  findById(id: number): Promise<Product | null>;
  findByBarcode?(barcode: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(id: number, product: Partial<Product>): Promise<Product>;
  delete(id: number): Promise<void>;
  updateStock(id: number, quantityChange: number): Promise<void>;
  /** Set products.stock to the exact value (used for cache sync from batch totals) */
  setStock(id: number, absoluteStock: number): Promise<void>;
  updateBatchStock(batchId: number, quantityChange: number): Promise<void>;
  countLowStock(threshold: number): Promise<number>;

  // ── Product Batches ────────────────────────────────────────────
  findBatchesByProductId(productId: number): Promise<ProductBatch[]>;
  createBatch(
    batch: Omit<ProductBatch, "id" | "createdAt">,
  ): Promise<ProductBatch>;
  findBatchById(batchId: number): Promise<ProductBatch | null>;

  // ── Product Units (Packaging / Conversion) ────────────────────
  findUnitsByProductId(productId: number): Promise<ProductUnit[]>;
  createUnit(unit: Omit<ProductUnit, "id" | "createdAt">): Promise<ProductUnit>;
  updateUnit(id: number, unit: Partial<ProductUnit>): Promise<ProductUnit>;
  deleteUnit(id: number): Promise<void>;
  setDefaultUnit(productId: number, unitId: number): Promise<void>;
}
