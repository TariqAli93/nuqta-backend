import { eq, like, and, sql, desc } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { products, productBatches, productUnits } from "../schema/schema.js";
import {
  IProductRepository,
  Product,
  ProductBatch,
  ProductUnit,
} from "@nuqta/core";

export class ProductRepository implements IProductRepository {
  constructor(private db: DbConnection) {}

  async findAll(params?: {
    search?: string;
    limit?: number;
    offset?: number;
    categoryId?: number;
    supplierId?: number;
    status?: string;
    lowStockOnly?: boolean;
    expiringSoonOnly?: boolean;
  }): Promise<{ items: Product[]; total: number }> {
    const conditions: any[] = [];
    if (params?.search) {
      conditions.push(
        sql`(${like(products.name, `%${params.search}%`)} OR ${like(products.sku, `%${params.search}%`)} OR ${like(products.barcode, `%${params.search}%`)})`,
      );
    }
    if (params?.categoryId)
      conditions.push(eq(products.categoryId, params.categoryId));
    if (params?.supplierId)
      conditions.push(eq(products.supplierId, params.supplierId));
    if (params?.status) conditions.push(eq(products.status, params.status));
    if (params?.lowStockOnly) {
      conditions.push(
        sql`${products.stock} <= ${products.minStock} AND ${products.minStock} > 0`,
      );
    }
    if (params?.expiringSoonOnly) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM product_batches pb
          WHERE pb.product_id = ${products.id}
            AND pb.quantity_on_hand > 0
            AND pb.expiry_date IS NOT NULL
            AND pb.expiry_date::date <= CURRENT_DATE + INTERVAL '30 days'
            AND pb.expiry_date::date >= CURRENT_DATE
        )`,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db.select().from(products).where(where).$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const items = await query;
    return { items: items as unknown as Product[], total };
  }

  async findById(id: number): Promise<Product | null> {
    const [item] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id));
    return (item as unknown as Product) || null;
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    // Check product barcode first
    const [byProduct] = await this.db
      .select()
      .from(products)
      .where(eq(products.barcode, barcode));
    if (byProduct) return byProduct as unknown as Product;

    // Then check product unit barcodes
    const [unitRow] = await this.db
      .select()
      .from(productUnits)
      .where(eq(productUnits.barcode, barcode));
    if (unitRow) {
      const [product] = await this.db
        .select()
        .from(products)
        .where(eq(products.id, unitRow.productId));
      return (product as unknown as Product) || null;
    }

    return null;
  }

  async create(product: Product): Promise<Product> {
    const [created] = await this.db
      .insert(products)
      .values(product as any)
      .returning();
    return created as unknown as Product;
  }

  async update(id: number, product: Partial<Product>): Promise<Product> {
    const [updated] = await this.db
      .update(products)
      .set({ ...product, updatedAt: new Date() } as any)
      .where(eq(products.id, id))
      .returning();
    return updated as unknown as Product;
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(products).where(eq(products.id, id));
  }

  async updateStock(id: number, quantityChange: number): Promise<void> {
    await this.db
      .update(products)
      .set({
        stock: sql`${products.stock} + ${quantityChange}`,
        updatedAt: new Date(),
      } as any)
      .where(eq(products.id, id));
  }

  async setStock(id: number, absoluteStock: number): Promise<void> {
    await this.db
      .update(products)
      .set({ stock: absoluteStock, updatedAt: new Date() } as any)
      .where(eq(products.id, id));
  }

  async updateBatchStock(
    batchId: number,
    quantityChange: number,
  ): Promise<void> {
    await this.db
      .update(productBatches)
      .set({
        quantityOnHand: sql`${productBatches.quantityOnHand} + ${quantityChange}`,
      } as any)
      .where(eq(productBatches.id, batchId));
  }

  async countLowStock(threshold: number): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          sql`${products.stock} <= ${threshold}`,
          sql`${products.minStock} > 0`,
        ),
      );
    return Number(result?.count ?? 0);
  }

  // ── Product Batches ────────────────────────────────────────────

  async findBatchesByProductId(productId: number): Promise<ProductBatch[]> {
    const rows = await this.db
      .select()
      .from(productBatches)
      .where(eq(productBatches.productId, productId))
      .orderBy(productBatches.createdAt);
    return rows as unknown as ProductBatch[];
  }

  async createBatch(
    batch: Omit<ProductBatch, "id" | "createdAt">,
  ): Promise<ProductBatch> {
    const [created] = await this.db
      .insert(productBatches)
      .values(batch as any)
      .returning();
    return created as unknown as ProductBatch;
  }

  async findBatchById(batchId: number): Promise<ProductBatch | null> {
    const [row] = await this.db
      .select()
      .from(productBatches)
      .where(eq(productBatches.id, batchId));
    return (row as unknown as ProductBatch) || null;
  }

  // ── Product Units ─────────────────────────────────────────────

  async findUnitsByProductId(productId: number): Promise<ProductUnit[]> {
    const rows = await this.db
      .select()
      .from(productUnits)
      .where(eq(productUnits.productId, productId));
    return rows as unknown as ProductUnit[];
  }

  async createUnit(
    unit: Omit<ProductUnit, "id" | "createdAt">,
  ): Promise<ProductUnit> {
    const [created] = await this.db
      .insert(productUnits)
      .values(unit as any)
      .returning();
    return created as unknown as ProductUnit;
  }

  async updateUnit(
    id: number,
    unit: Partial<ProductUnit>,
  ): Promise<ProductUnit> {
    const [updated] = await this.db
      .update(productUnits)
      .set(unit as any)
      .where(eq(productUnits.id, id))
      .returning();
    return updated as unknown as ProductUnit;
  }

  async deleteUnit(id: number): Promise<void> {
    await this.db.delete(productUnits).where(eq(productUnits.id, id));
  }

  async setDefaultUnit(productId: number, unitId: number): Promise<void> {
    // Reset all units for this product
    await this.db
      .update(productUnits)
      .set({ isDefault: false } as any)
      .where(eq(productUnits.productId, productId));
    // Set the chosen unit as default
    await this.db
      .update(productUnits)
      .set({ isDefault: true } as any)
      .where(eq(productUnits.id, unitId));
  }
}
