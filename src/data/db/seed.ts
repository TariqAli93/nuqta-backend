import { Command } from "commander";
import { and, eq } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AdjustProductStockUseCase,
  CreateCategoryUseCase,
  CreateCustomerUseCase,
  CreateProductUseCase,
  CreatePurchaseUseCase,
  CreateSaleUseCase,
  CreateSupplierUseCase,
  CreateUserUseCase,
  InitializeAccountingUseCase,
  ReconcileCustomerDebtUseCase,
  ReconcileStockUseCase,
  ReconcileSupplierBalanceUseCase,
  type Category,
  type Customer,
  type Product,
  type ProductUnit,
  type Purchase,
  type PurchaseItem,
  type Sale,
  type Supplier,
  type User,
} from "../../domain/index.js";

import { db, pool } from "./db.js";
import { AccountingRepository } from "../repositories/accounting/AccountingRepository.js";
import { AuditRepository } from "../repositories/audit/AuditRepository.js";
import { BarcodeRepository } from "../repositories/barcode/BarcodeRepository.js";
import { CategoryRepository } from "../repositories/categories/CategoryRepository.js";
import { CustomerLedgerRepository } from "../repositories/customer-ledger/CustomerLedgerRepository.js";
import { CustomerRepository } from "../repositories/customers/CustomerRepository.js";
import { InventoryRepository } from "../repositories/inventory/InventoryRepository.js";
import { PaymentRepository } from "../repositories/payments/PaymentRepository.js";
import { ProductRepository } from "../repositories/products/ProductRepository.js";
import { PurchaseRepository } from "../repositories/purchases/PurchaseRepository.js";
import { SaleRepository } from "../repositories/sales/SaleRepository.js";
import { AccountingSettingsRepository } from "../repositories/settings/AccountingSettingsRepository.js";
import { BarcodeSettingsRepository } from "../repositories/settings/BarcodeSettingsRepository.js";
import { PosSettingsRepository } from "../repositories/settings/PosSettingsRepository.js";
import { SettingsRepository } from "../repositories/settings/SettingsRepository.js";
import { SystemSettingsRepository } from "../repositories/settings/SystemSettingsRepository.js";
import { SupplierLedgerRepository } from "../repositories/supplier-ledger/SupplierLedgerRepository.js";
import { SupplierRepository } from "../repositories/suppliers/SupplierRepository.js";

import {
  currencySettings,
  inventoryMovements,
  productBatches,
  productUnits,
  purchaseItems,
  settings,
} from "../schema/schema.js";
import { FifoService } from "../shared/services/FifoService.js";
import {
  PRESETS,
  PRESET_MENU,
  type Preset,
  type PresetCustomer,
  type PresetKey,
  type PresetProduct,
  type PresetPurchase,
  type PresetSale,
  type PresetSupplier,
} from "./presets.js";

type SeedUser = User & { id: number };
type SeedCategory = Category & { id: number };
type SeedCustomer = Customer & { id: number };
type SeedProduct = Product & { id: number };
type SeedSupplier = Supplier & { id: number };
type EnsureResult<T> = { entity: T; created: boolean };

interface SeedCounters {
  users: number;
  categories: number;
  suppliers: number;
  products: number;
  productUnits: number;
  customers: number;
  purchases: number;
  sales: number;
  payments: number;
  batches: number;
  inventoryMovements: number;
}

const DEFAULT_PRESET: PresetKey = "supermarket";
const VALID_PRESETS = Object.keys(PRESETS) as PresetKey[];

function requireId<T extends { id?: number }>(
  entity: T,
  label: string,
): T & { id: number } {
  if (entity.id == null) {
    throw new Error(`${label} is missing id`);
  }
  return entity as T & { id: number };
}

function resolvePresets(raw: string | undefined): PresetKey[] {
  if (!raw) return [DEFAULT_PRESET];

  const keys = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean) as PresetKey[];
  const valid = keys.filter((key) => VALID_PRESETS.includes(key));

  if (valid.length > 0) {
    return Array.from(new Set(valid));
  }

  console.warn(
    `No valid presets in "${raw}". Defaulting to ${DEFAULT_PRESET}.`,
  );
  return [DEFAULT_PRESET];
}

function parseCliPresets(): PresetKey[] {
  const program = new Command();

  program
    .name("seed")
    .description("Seed the Nuqta database with preset business data")
    .option(
      "-p, --preset <presets>",
      `Comma-separated preset keys: ${VALID_PRESETS.join(", ")}`,
      process.env.SEED_PRESET,
    )
    .addHelpText(
      "after",
      `\nAvailable presets:\n${PRESET_MENU.map((item) => `  ${item.value} - ${item.label}`).join("\n")}`,
    )
    .parse(process.argv);

  return resolvePresets(program.opts<{ preset?: string }>().preset);
}

function emptyCounters(): SeedCounters {
  return {
    users: 0,
    categories: 0,
    suppliers: 0,
    products: 0,
    productUnits: 0,
    customers: 0,
    purchases: 0,
    sales: 0,
    payments: 0,
    batches: 0,
    inventoryMovements: 0,
  };
}

function addCounters(target: SeedCounters, source: SeedCounters): void {
  target.users += source.users;
  target.categories += source.categories;
  target.suppliers += source.suppliers;
  target.products += source.products;
  target.productUnits += source.productUnits;
  target.customers += source.customers;
  target.purchases += source.purchases;
  target.sales += source.sales;
  target.payments += source.payments;
  target.batches += source.batches;
  target.inventoryMovements += source.inventoryMovements;
}

async function markerExists(
  productId: number,
  marker: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: inventoryMovements.id })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.productId, productId),
        eq(inventoryMovements.notes, marker),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

function toBaseCost(
  unitCost: number,
  unitFactor: number,
  context: string,
): number {
  if (unitFactor <= 1) {
    return unitCost;
  }

  if (unitCost % unitFactor !== 0) {
    console.warn(
      `Non-even base cost for ${context}; rounding ${unitCost}/${unitFactor}.`,
    );
  }

  return Math.round(unitCost / unitFactor);
}

async function initializeDatabase(): Promise<void> {
  const selectedKeys = parseCliPresets();
  console.log("\nConnecting to PostgreSQL database...");
  console.log(
    `\nSelected preset(s): ${selectedKeys.map((key) => PRESETS[key].label).join(", ")}`,
  );

  const categoryRepo = new CategoryRepository(db);
  const supplierRepo = new SupplierRepository(db);
  const productRepo = new ProductRepository(db);
  const customerRepo = new CustomerRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const systemSettingsRepo = new SystemSettingsRepository(db);
  const accountingSettingsRepo = new AccountingSettingsRepository(db);
  const posSettingsRepo = new PosSettingsRepository(db);
  const barcodeSettingsRepo = new BarcodeSettingsRepository(db);
  const inventoryRepo = new InventoryRepository(db);
  const barcodeRepo = new BarcodeRepository(db);
  const accountingRepo = new AccountingRepository(db);
  const paymentRepo = new PaymentRepository(db);
  const customerLedgerRepo = new CustomerLedgerRepository(db);
  const supplierLedgerRepo = new SupplierLedgerRepository(db);
  const purchaseRepo = new PurchaseRepository(db);
  const saleRepo = new SaleRepository(db);
  const auditRepo = new AuditRepository(db);
  const fifoService = new FifoService(db);

  const createCategoryUseCase = new CreateCategoryUseCase(categoryRepo);
  const createSupplierUseCase = new CreateSupplierUseCase(supplierRepo);
  const createProductUseCase = new CreateProductUseCase(productRepo, auditRepo);
  const createCustomerUseCase = new CreateCustomerUseCase(customerRepo);
  const createPurchaseUseCase = new CreatePurchaseUseCase(
    db,
    purchaseRepo,
    supplierRepo,
    paymentRepo,
    supplierLedgerRepo,
    accountingRepo,
    settingsRepo,
    auditRepo,
  );
  const createSaleUseCase = new CreateSaleUseCase(
    db,
    saleRepo,
    productRepo,
    customerRepo,
    settingsRepo,
    paymentRepo,
    inventoryRepo,
    accountingRepo,
    customerLedgerRepo,
    auditRepo,
    fifoService,
  );
  const adjustStockUseCase = new AdjustProductStockUseCase(
    productRepo,
    inventoryRepo,
    accountingRepo,
    auditRepo,
    settingsRepo,
    accountingSettingsRepo,
  );
  const initializeAccountingUseCase = new InitializeAccountingUseCase(
    settingsRepo,
    accountingRepo,
  );
  const reconcileCustomerDebtUseCase = new ReconcileCustomerDebtUseCase(
    customerRepo,
    customerLedgerRepo,
  );
  const reconcileSupplierBalanceUseCase = new ReconcileSupplierBalanceUseCase(
    supplierRepo,
    supplierLedgerRepo,
  );
  const reconcileStockUseCase = new ReconcileStockUseCase(
    productRepo,
    inventoryRepo,
  );

  const categoriesByName = new Map<string, Category>(
    (await categoryRepo.findAll()).map((category) => [category.name, category]),
  );
  const suppliersByName = new Map<string, Supplier>(
    (await supplierRepo.findAll({ limit: 100_000, offset: 0 })).items.map(
      (supplier) => [supplier.name, supplier],
    ),
  );
  const customersByName = new Map<string, Customer>(
    (await customerRepo.findAll({ limit: 100_000, offset: 0 })).items.map(
      (customer) => [customer.name, customer],
    ),
  );
  const productsBySku = new Map<string, Product>();
  const existingProducts = await productRepo.findAll({
    limit: 100_000,
    offset: 0,
  });
  for (const product of existingProducts.items) {
    if (product.sku) {
      productsBySku.set(product.sku, product);
    }
  }
  const unitsByProductId = new Map<number, ProductUnit[]>();

  async function loadUnits(productId: number): Promise<ProductUnit[]> {
    const cached = unitsByProductId.get(productId);
    if (cached) {
      return cached;
    }

    const units = await productRepo.findUnitsByProductId(productId);
    unitsByProductId.set(productId, units);
    return units;
  }

  async function upsertSetting(key: string, value: string): Promise<void> {
    await db
      .insert(settings)
      .values({ key, value } as typeof settings.$inferInsert)
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  async function upsertCurrency(
    row: typeof currencySettings.$inferInsert,
  ): Promise<void> {
    await db
      .insert(currencySettings)
      .values(row)
      .onConflictDoUpdate({
        target: currencySettings.currencyCode,
        set: {
          currencyName: row.currencyName,
          symbol: row.symbol,
          exchangeRate: row.exchangeRate,
          isBaseCurrency: row.isBaseCurrency,
          isActive: row.isActive ?? true,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  async function ensureCategory(
    input: Preset["categories"][number],
    createdBy: number,
  ): Promise<EnsureResult<SeedCategory>> {
    const existing = categoriesByName.get(input.name);
    if (existing) {
      return {
        entity: requireId(existing, `category:${input.name}`),
        created: false,
      };
    }

    const created = await createCategoryUseCase.execute(
      {
        name: input.name,
        description: input.description,
        isActive: true,
        createdBy,
      } as Category,
      String(createdBy),
    );

    const withId = requireId(created, `category:${input.name}`);
    categoriesByName.set(withId.name, withId);
    return { entity: withId, created: true };
  }

  async function ensureSupplier(
    input: PresetSupplier,
    createdBy: number,
  ): Promise<EnsureResult<SeedSupplier>> {
    const existing = suppliersByName.get(input.name);
    if (existing) {
      return {
        entity: requireId(existing, `supplier:${input.name}`),
        created: false,
      };
    }

    const created = await createSupplierUseCase.execute(
      {
        name: input.name,
        phone: input.phone,
        phone2: null,
        address: input.address,
        city: input.city,
        notes: input.notes,
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
        createdBy,
      },
      String(createdBy),
    );

    const withId = requireId(created, `supplier:${input.name}`);
    suppliersByName.set(withId.name, withId);
    return { entity: withId, created: true };
  }

  async function ensureCustomer(
    input: PresetCustomer,
    createdBy: number,
  ): Promise<EnsureResult<SeedCustomer>> {
    const existing = customersByName.get(input.name);
    if (existing) {
      return {
        entity: requireId(existing, `customer:${input.name}`),
        created: false,
      };
    }

    const created = await createCustomerUseCase.execute(
      {
        name: input.name,
        phone: input.phone,
        address: input.address,
        city: input.city,
        notes: input.notes,
        totalPurchases: 0,
        totalDebt: 0,
        isActive: true,
        createdBy,
      } as Customer,
      String(createdBy),
    );

    const withId = requireId(created, `customer:${input.name}`);
    customersByName.set(withId.name, withId);
    return { entity: withId, created: true };
  }

  async function ensureProduct(
    input: PresetProduct,
    categoryId: number,
    supplierId: number | undefined,
    createdBy: number,
  ): Promise<EnsureResult<SeedProduct>> {
    const existing = input.sku ? productsBySku.get(input.sku) : undefined;
    if (existing) {
      return {
        entity: requireId(existing, `product:${input.sku}`),
        created: false,
      };
    }

    const created = await createProductUseCase.execute(
      {
        name: input.name,
        sku: input.sku,
        categoryId,
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        stock: 0,
        minStock: input.minStock,
        unit: input.unit,
        supplierId,
        trackExpiry: input.trackExpiry ?? false,
        status: input.status,
        isActive: true,
        createdBy,
      },
      String(createdBy),
    );

    const withId = requireId(created, `product:${input.sku}`);
    if (withId.sku) {
      productsBySku.set(withId.sku, withId);
    }
    return { entity: withId, created: true };
  }

  async function ensureUnitRow(
    product: SeedProduct,
    unitName: string,
    factorToBase: number,
    options: {
      barcode?: string;
      sellingPrice?: number;
      isDefault: boolean;
    },
  ): Promise<boolean> {
    const existingUnits = await loadUnits(product.id);
    const existing = existingUnits.find((unit) => unit.unitName === unitName);
    if (existing) {
      return false;
    }

    const [created] = await db
      .insert(productUnits)
      .values({
        productId: product.id,
        unitName,
        factorToBase,
        barcode: options.barcode ?? null,
        sellingPrice: options.sellingPrice ?? null,
        isDefault: options.isDefault,
        isActive: true,
      })
      .returning();

    existingUnits.push(created as ProductUnit);
    unitsByProductId.set(product.id, existingUnits);
    return true;
  }

  async function ensureProductUnitsForSeed(
    product: SeedProduct,
    presetProduct: PresetProduct,
  ): Promise<number> {
    let created = 0;

    if (presetProduct.units && presetProduct.units.length > 0) {
      if (
        await ensureUnitRow(product, presetProduct.unit, 1, {
          barcode: product.barcode ?? undefined,
          sellingPrice: presetProduct.sellingPrice,
          isDefault: true,
        })
      ) {
        created += 1;
      }
    }

    for (const unit of presetProduct.units ?? []) {
      if (
        await ensureUnitRow(product, unit.unitName, unit.factorToBase, {
          barcode: unit.barcode,
          sellingPrice: unit.sellingPrice,
          isDefault: false,
        })
      ) {
        created += 1;
      }
    }

    return created;
  }

  async function resolveUnitContext(
    product: SeedProduct,
    requestedUnitName?: string,
  ): Promise<{ unitName: string; unitFactor: number; sellingPrice: number }> {
    const baseUnitName = product.unit ?? "piece";
    const configuredUnits = await loadUnits(product.id);

    if (requestedUnitName && requestedUnitName === baseUnitName) {
      return {
        unitName: baseUnitName,
        unitFactor: 1,
        sellingPrice: product.sellingPrice,
      };
    }

    if (requestedUnitName) {
      const matched = configuredUnits.find(
        (unit) => unit.unitName === requestedUnitName && unit.isActive,
      );
      if (matched) {
        return {
          unitName: matched.unitName,
          unitFactor: matched.factorToBase,
          sellingPrice: matched.sellingPrice ?? product.sellingPrice,
        };
      }
    }

    if (configuredUnits.length > 0) {
      const defaultUnit =
        configuredUnits.find((unit) => unit.isDefault && unit.isActive) ??
        configuredUnits.find((unit) => unit.isActive);
      if (defaultUnit) {
        return {
          unitName: defaultUnit.unitName,
          unitFactor: defaultUnit.factorToBase,
          sellingPrice: defaultUnit.sellingPrice ?? product.sellingPrice,
        };
      }
    }

    return {
      unitName: requestedUnitName ?? baseUnitName,
      unitFactor: 1,
      sellingPrice: product.sellingPrice,
    };
  }

  async function seedMarkerAdjustment(
    product: SeedProduct,
    marker: string,
    quantityBase: number,
    createdBy: number,
  ): Promise<boolean> {
    if (quantityBase <= 0) {
      return false;
    }

    if (await markerExists(product.id, marker)) {
      return false;
    }

    await adjustStockUseCase.executeCommitPhase(
      {
        productId: product.id,
        quantityChange: quantityBase,
        reason: "opening",
        notes: marker,
        unitName: product.unit ?? "piece",
        unitFactor: 1,
        createdBy,
      },
      String(createdBy),
    );

    return true;
  }

  async function ensurePurchase(
    presetKey: PresetKey,
    purchase: PresetPurchase,
    supplier: SeedSupplier,
    productMap: Map<string, SeedProduct>,
    createdBy: number,
  ): Promise<EnsureResult<Purchase>> {
    const idempotencyKey = `seed:${presetKey}:purchase:${purchase.invoiceNumber}`;
    const existing = await purchaseRepo.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { entity: existing, created: false };
    }

    const items: Array<{
      productId: number;
      productName: string;
      unitName: string;
      unitFactor: number;
      quantity: number;
      quantityBase: number;
      unitCost: number;
      lineSubtotal: number;
    }> = [];

    for (const item of purchase.items) {
      const product = productMap.get(item.productRef);
      if (!product) {
        console.warn(
          `Missing product ${item.productRef} for purchase ${purchase.invoiceNumber}; skipping item.`,
        );
        continue;
      }

      const unit = await resolveUnitContext(product, item.unit);
      items.push({
        productId: product.id,
        productName: product.name,
        unitName: unit.unitName,
        unitFactor: unit.unitFactor,
        quantity: item.quantity,
        quantityBase: item.quantity * unit.unitFactor,
        unitCost: item.unitCost,
        lineSubtotal: item.quantity * item.unitCost,
      });
    }

    if (items.length === 0) {
      throw new Error(`Purchase ${purchase.invoiceNumber} has no valid items`);
    }

    const created = await createPurchaseUseCase.execute(
      {
        invoiceNumber: purchase.invoiceNumber,
        supplierId: supplier.id,
        items,
        paidAmount: purchase.paidAmount,
        currency: "IQD",
        notes: purchase.notes,
        paymentMethod: purchase.paidAmount > 0 ? "cash" : "credit",
        idempotencyKey,
      },
      String(createdBy),
    );

    return { entity: created, created: true };
  }

  async function materializePurchaseInventory(
    purchase: Purchase,
    createdBy: number,
  ): Promise<{ batches: number; inventoryMovements: number }> {
    let batchesCreated = 0;
    let movementsCreated = 0;
    const items = purchase.items ?? [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index] as PurchaseItem;
      const movementMarker = `seed:purchase:${purchase.id}:item:${item.id ?? index}`;

      if (await markerExists(item.productId, movementMarker)) {
        continue;
      }

      const product = await productRepo.findById(item.productId);
      if (!product) {
        console.warn(
          `Missing product ${item.productId} while materializing purchase ${purchase.invoiceNumber}.`,
        );
        continue;
      }

      const productWithId = requireId(product, `product:${item.productId}`);
      const batchNumber =
        item.batchNumber ??
        `SEED-PUR-${purchase.id}-${index + 1}-${item.productId}`;

      const [existingBatch] = await db
        .select()
        .from(productBatches)
        .where(
          and(
            eq(productBatches.productId, item.productId),
            eq(productBatches.batchNumber, batchNumber),
          ),
        )
        .limit(1);

      const batch =
        existingBatch ??
        (await db
          .insert(productBatches)
          .values({
            productId: item.productId,
            batchNumber,
            quantityReceived: item.quantityBase,
            quantityOnHand: item.quantityBase,
            costPerUnit: toBaseCost(
              item.unitCost,
              item.unitFactor,
              `${purchase.invoiceNumber}/${item.productName}`,
            ),
            purchaseId: purchase.id,
            expiryDate:
              typeof item.expiryDate === "string"
                ? item.expiryDate
                : (item.expiryDate?.toISOString() ?? null),
            status: "active",
            notes: movementMarker,
          })
          .returning()
          .then((rows) => rows[0]));

      if (!existingBatch) {
        batchesCreated += 1;
      }

      if (item.id) {
        await db
          .update(purchaseItems)
          .set({
            batchId: batch.id,
            expiryDate:
              typeof item.expiryDate === "string"
                ? item.expiryDate
                : (item.expiryDate?.toISOString() ?? null),
          })
          .where(eq(purchaseItems.id, item.id));
      }

      const allBatches = await productRepo.findBatchesByProductId(
        item.productId,
      );
      const stockAfter = allBatches.reduce(
        (sum, currentBatch) => sum + currentBatch.quantityOnHand,
        0,
      );
      const stockBefore = productWithId.stock ?? 0;

      await inventoryRepo.createMovementSync({
        productId: item.productId,
        batchId: batch.id,
        movementType: "in",
        reason: "purchase",
        quantityBase: item.quantityBase,
        unitName: item.unitName,
        unitFactor: item.unitFactor,
        stockBefore,
        stockAfter,
        costPerUnit: batch.costPerUnit ?? productWithId.costPrice,
        totalCost: item.lineSubtotal,
        sourceType: "purchase",
        sourceId: purchase.id,
        notes: movementMarker,
        createdBy,
      });
      await productRepo.setStock(item.productId, stockAfter);

      if (
        (productWithId.status ?? "available") === "out_of_stock" &&
        stockAfter > 0
      ) {
        await productRepo.update(item.productId, { status: "available" });
      }

      movementsCreated += 1;
      if (productWithId.sku) {
        productsBySku.set(productWithId.sku, {
          ...productWithId,
          stock: stockAfter,
          status: stockAfter > 0 ? "available" : productWithId.status,
        });
      }
    }

    return { batches: batchesCreated, inventoryMovements: movementsCreated };
  }

  async function ensureSale(
    presetKey: PresetKey,
    sale: PresetSale,
    saleIndex: number,
    customerId: number | undefined,
    productMap: Map<string, SeedProduct>,
    createdBy: number,
  ): Promise<EnsureResult<Sale>> {
    const idempotencyKey = `seed:${presetKey}:sale:${saleIndex + 1}`;
    const existing = await saleRepo.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { entity: existing, created: false };
    }

    for (let itemIndex = 0; itemIndex < sale.items.length; itemIndex += 1) {
      const saleItem = sale.items[itemIndex]!;
      const product = productMap.get(saleItem.productRef);
      if (!product) {
        throw new Error(
          `Missing product ${saleItem.productRef} for sale ${saleIndex + 1}`,
        );
      }

      const unit = await resolveUnitContext(product, saleItem.unit);
      const requiredQuantity = saleItem.quantity * unit.unitFactor;
      const availableStock = await fifoService.getAvailableStock(product.id);
      const shortage = Math.max(0, requiredQuantity - availableStock);

      if (shortage > 0) {
        const marker = `seed:${presetKey}:sale-support:${saleIndex + 1}:${itemIndex + 1}:${product.sku ?? product.id}`;
        await seedMarkerAdjustment(product, marker, shortage, createdBy);
      }
    }

    const items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      unitName: string;
      unitFactor: number;
    }> = [];

    for (const saleItem of sale.items) {
      const product = productMap.get(saleItem.productRef);
      if (!product) {
        continue;
      }

      const unit = await resolveUnitContext(product, saleItem.unit);
      items.push({
        productId: product.id,
        quantity: saleItem.quantity,
        unitPrice: unit.sellingPrice,
        unitName: unit.unitName,
        unitFactor: unit.unitFactor,
      });
    }

    if (items.length === 0) {
      throw new Error(`Sale ${saleIndex + 1} has no valid items`);
    }

    const created = await createSaleUseCase.execute(
      {
        customerId,
        items,
        discount: sale.discount,
        paymentType: sale.paymentType,
        paidAmount: sale.paidAmount,
        currency: "IQD",
        notes: sale.notes,
        interestRate: sale.interestRate,
        paymentMethod:
          sale.paymentType === "credit"
            ? "credit"
            : sale.paymentType === "cash"
              ? "cash"
              : "cash",
        idempotencyKey,
      },
      String(createdBy),
    );

    return { entity: created, created: true };
  }

  async function seedBaselineSettings(): Promise<void> {
    console.log("Seeding settings and module configuration...");

    const settingEntries: Array<[string, string]> = [
      ["app_initialized", "true"],
      ["initialized_at", new Date().toISOString()],
      ["default_currency", "IQD"],
      ["currency.base", "IQD"],
      ["company_name", "المتجر النموذجي"],
      ["company_address", "شارع الرشيد، بغداد، العراق"],
      ["company_phone", "+964770123456"],
      ["tax_rate", "0"],
      ["receipt_footer", "شكراً لتسوقكم معنا"],
      ["low_stock_threshold", "10"],
      ["setup.wizardCompleted", "true"],
      ["setup.wizard_completed", "true"],
      ["accounting.enabled", "true"],
      ["modules.accounting.enabled", "true"],
      ["purchases.enabled", "true"],
      ["modules.purchases.enabled", "true"],
      ["ledgers.enabled", "true"],
      ["modules.ledgers.enabled", "true"],
      ["units.enabled", "true"],
      ["modules.units.enabled", "true"],
      ["paymentsOnInvoices.enabled", "true"],
      ["modules.paymentsOnInvoices.enabled", "true"],
      ["notifications.lowStockThreshold", "10"],
      ["notifications.expiryDays", "30"],
      ["notifications.debtReminderCount", "3"],
      ["notifications.debtReminderIntervalDays", "7"],
      ["invoice.template.activeId", "default"],
      ["invoice.series.prefix", "INV"],
      ["invoice.paperSize", "thermal"],
      ["invoice.layoutDirection", "rtl"],
      ["invoice.footerNotes", "شكراً لتسوقكم معنا"],
      ["invoice.showQr", "false"],
      ["invoice.showBarcode", "false"],
      ["barcode.printerType", "thermal"],
      ["barcode.dpi", "203"],
      ["system.language", "ar"],
      ["system.timezone", "Asia/Baghdad"],
    ];

    for (const [key, value] of settingEntries) {
      await upsertSetting(key, value);
    }

    await upsertCurrency({
      currencyCode: "IQD",
      currencyName: "دينار عراقي",
      symbol: "ع.د",
      exchangeRate: 1,
      isBaseCurrency: true,
      isActive: true,
    });
    await upsertCurrency({
      currencyCode: "USD",
      currencyName: "دولار أمريكي",
      symbol: "$",
      exchangeRate: 1480,
      isBaseCurrency: false,
      isActive: true,
    });

    await systemSettingsRepo.update({
      companyName: "المتجر النموذجي",
      companyAddress: "شارع الرشيد، بغداد، العراق",
      companyPhone: "+964770123456",
      defaultCurrency: "IQD",
      lowStockThreshold: 10,
      accountingEnabled: true,
      purchasesEnabled: true,
      ledgersEnabled: true,
      unitsEnabled: true,
      paymentsOnInvoicesEnabled: true,
      expiryAlertDays: 30,
      debtReminderCount: 3,
      debtReminderIntervalDays: 7,
      setupWizardCompleted: true,
    });

    await accountingSettingsRepo.update({
      taxEnabled: false,
      defaultTaxRate: 0,
      fiscalYearStartMonth: 1,
      fiscalYearStartDay: 1,
      autoPosting: true,
      costMethod: "fifo",
      currencyCode: "IQD",
      usdExchangeRate: 1480,
      roundingMethod: "round",
    });

    await posSettingsRepo.update({
      invoicePrefix: "INV",
      invoiceTemplateId: "default",
      paperSize: "thermal",
      layoutDirection: "rtl",
      showQr: false,
      showBarcode: false,
      invoiceFooterNotes: "شكراً لتسوقكم معنا",
      receiptFooter: "شكراً لتسوقكم معنا",
      quickSaleEnabled: true,
      soundEnabled: true,
    });

    await barcodeSettingsRepo.update({
      defaultBarcodeType: "CODE128",
      defaultWidth: 200,
      defaultHeight: 100,
      showPrice: true,
      showProductName: true,
      showExpiryDate: false,
      encoding: "UTF-8",
      printDpi: 203,
      labelWidthMm: 50,
      labelHeightMm: 30,
      marginTop: 2,
      marginBottom: 2,
      marginLeft: 2,
      marginRight: 2,
    });

    const accountingResult = await initializeAccountingUseCase.execute(
      {
        baseCurrency: "IQD",
      },
      "1",
    );
    for (const warning of accountingResult.warnings) {
      console.warn(warning);
    }

    const templates = await barcodeRepo.findAllTemplates();
    const defaultTemplate =
      templates.find((template) => template.isDefault) ??
      templates[0] ??
      (await barcodeRepo.createTemplate({
        name: "قالب افتراضي",
        width: 50,
        height: 25,
        barcodeType: "CODE128",
        showPrice: true,
        showName: true,
        showBarcode: true,
        showExpiry: false,
        isDefault: true,
      }));

    if (defaultTemplate.id != null) {
      await upsertSetting(
        "barcode.defaultTemplateId",
        String(defaultTemplate.id),
      );
    }
  }

  console.log("Seeding baseline data...");
  await seedBaselineSettings();

  const totalCounters = emptyCounters();

  const pickCreator = 1;

  for (const presetKey of selectedKeys) {
    const preset = PRESETS[presetKey];
    const presetCounters = emptyCounters();
    const categoryMap = new Map<string, SeedCategory>();
    const supplierMap = new Map<string, SeedSupplier>();
    const productMap = new Map<string, SeedProduct>();
    const customerList: SeedCustomer[] = [];

    console.log(`\nSeeding preset ${presetKey} (${preset.label})...`);

    for (let index = 0; index < preset.categories.length; index += 1) {
      const result = await ensureCategory(
        preset.categories[index]!,
        pickCreator,
      );
      categoryMap.set(result.entity.name, result.entity);
      presetCounters.categories += Number(result.created);
    }

    for (let index = 0; index < preset.suppliers.length; index += 1) {
      const result = await ensureSupplier(
        preset.suppliers[index]!,
        pickCreator,
      );
      supplierMap.set(result.entity.name, result.entity);
      presetCounters.suppliers += Number(result.created);
    }

    for (let index = 0; index < preset.products.length; index += 1) {
      const presetProduct = preset.products[index]!;
      const category = categoryMap.get(presetProduct.categoryRef);
      if (!category) {
        console.warn(
          `Category ${presetProduct.categoryRef} is missing for ${presetProduct.sku}; skipping product.`,
        );
        continue;
      }

      const supplier = supplierMap.get(presetProduct.supplierRef);
      const result = await ensureProduct(
        presetProduct,
        category.id,
        supplier?.id,
        pickCreator,
      );
      productMap.set(presetProduct.sku, result.entity);
      presetCounters.products += Number(result.created);
      presetCounters.productUnits += await ensureProductUnitsForSeed(
        result.entity,
        presetProduct,
      );
    }

    for (let index = 0; index < preset.purchases.length; index += 1) {
      const presetPurchase = preset.purchases[index]!;
      const supplier = supplierMap.get(presetPurchase.supplierRef);
      if (!supplier) {
        console.warn(
          `Supplier ${presetPurchase.supplierRef} is missing for purchase ${presetPurchase.invoiceNumber}; skipping purchase.`,
        );
        continue;
      }

      const result = await ensurePurchase(
        presetKey,
        presetPurchase,
        supplier,
        productMap,
        pickCreator,
      );
      presetCounters.purchases += Number(result.created);
      presetCounters.payments += Number(
        result.created && presetPurchase.paidAmount > 0,
      );

      const inventoryResult = await materializePurchaseInventory(
        result.entity,
        pickCreator,
      );
      presetCounters.batches += inventoryResult.batches;
      presetCounters.inventoryMovements += inventoryResult.inventoryMovements;
    }

    const purchasedSkus = new Set(
      preset.purchases.flatMap((purchase) =>
        purchase.items.map((item) => item.productRef),
      ),
    );

    for (const presetProduct of preset.products) {
      if (purchasedSkus.has(presetProduct.sku) || presetProduct.stock <= 0) {
        continue;
      }

      const product = productMap.get(presetProduct.sku);
      if (!product) {
        continue;
      }

      const batches = await productRepo.findBatchesByProductId(product.id);
      if (batches.length > 0) {
        continue;
      }

      const marker = `seed:${presetKey}:opening:${presetProduct.sku}`;
      if (
        await seedMarkerAdjustment(
          product,
          marker,
          presetProduct.stock,
          pickCreator,
        )
      ) {
        presetCounters.batches += 1;
        presetCounters.inventoryMovements += 1;
      }
    }

    for (let index = 0; index < preset.customers.length; index += 1) {
      const result = await ensureCustomer(
        preset.customers[index]!,
        pickCreator,
      );
      customerList.push(result.entity);
      presetCounters.customers += Number(result.created);
    }

    for (let index = 0; index < preset.sales.length; index += 1) {
      const presetSale = preset.sales[index]!;
      const customer = customerList[presetSale.customerRef];
      const result = await ensureSale(
        presetKey,
        presetSale,
        index,
        customer?.id,
        productMap,
        pickCreator,
      );

      presetCounters.sales += Number(result.created);
      presetCounters.payments += Number(
        result.created && presetSale.paidAmount > 0,
      );
    }

    addCounters(totalCounters, presetCounters);
  }

  const repairedCustomerDebt = await reconcileCustomerDebtUseCase.repair();
  const repairedSupplierBalance =
    await reconcileSupplierBalanceUseCase.repair();
  const repairedStock = await reconcileStockUseCase.repair();

  console.log("\nDatabase seeded successfully.");
  console.log(`Users created: ${totalCounters.users}`);
  console.log(`Categories created: ${totalCounters.categories}`);
  console.log(`Suppliers created: ${totalCounters.suppliers}`);
  console.log(`Products created: ${totalCounters.products}`);
  console.log(`Product units created: ${totalCounters.productUnits}`);
  console.log(`Customers created: ${totalCounters.customers}`);
  console.log(`Purchases created: ${totalCounters.purchases}`);
  console.log(`Sales created: ${totalCounters.sales}`);
  console.log(`Payments created: ${totalCounters.payments}`);
  console.log(`Batches created: ${totalCounters.batches}`);
  console.log(
    `Inventory movements created: ${totalCounters.inventoryMovements}`,
  );
  console.log(`Customer debt rows repaired: ${repairedCustomerDebt}`);
  console.log(`Supplier balance rows repaired: ${repairedSupplierBalance}`);
  console.log(`Stock rows repaired: ${repairedStock}`);
  console.log("");
  console.log("Test credentials:");
  console.log("  admin / Admin@123");
  console.log("  manager / Manager@123");
  console.log("  cashier / Cashier@123");
  console.log("  cashier2 / Cashier@123");
  console.log("  viewer / Viewer@123");
}

const __filename = fileURLToPath(import.meta.url);
const entryArg = process.argv[1];

if (entryArg && path.resolve(entryArg) === path.resolve(__filename)) {
  initializeDatabase()
    .then(async () => {
      console.log("\nSeed completed.");
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("\nSeed failed:", error);
      await pool.end();
      process.exit(1);
    });
}

export { initializeDatabase };
