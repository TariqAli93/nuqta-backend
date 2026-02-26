import { Command } from "commander";
import path from "path";
import { fileURLToPath } from "url";
import { db, queryClient } from "./db.js";
import {
  UserRepository,
  ProductRepository,
  CategoryRepository,
  SettingsRepository,
  InventoryRepository,
  BarcodeRepository,
  AccountingRepository,
} from "@nuqta/data";

import {
  CreateCategoryUseCase,
  CreateProductUseCase,
  CreateUserUseCase,
  AdjustProductStockUseCase,
} from "@nuqta/core";

import { productUnits, accounts, currencySettings } from "./schema/schema.js";

import {
  PRESETS,
  PRESET_MENU,
  type PresetKey,
  type Preset,
  type PresetProduct,
  type PresetProductUnit,
} from "./presets.js";

// ============================================================
// CLI (commander.js)
// ============================================================

const VALID_PRESETS = Object.keys(PRESETS) as PresetKey[];

function resolvePresets(raw: string | undefined): PresetKey[] {
  if (!raw) return ["supermarket"];
  const keys = raw.split(",").map((k) => k.trim().toLowerCase()) as PresetKey[];
  const valid = keys.filter((k) => VALID_PRESETS.includes(k));
  if (valid.length === 0) {
    console.warn(
      `⚠️  No valid presets in "${raw}". Defaulting to supermarket.`,
    );
    return ["supermarket"];
  }
  return valid;
}

function parseCliPresets(): PresetKey[] {
  const program = new Command();
  program
    .name("seed")
    .description("Seed the NuqtaPlus database with preset data")
    .option(
      "-p, --preset <presets>",
      `Comma-separated preset keys: ${VALID_PRESETS.join(", ")}`,
      process.env.SEED_PRESET,
    )
    .addHelpText(
      "after",
      `\nAvailable presets:\n${PRESET_MENU.map((m) => `  ${m.label}`).join("\n")}`,
    )
    .parse(process.argv);

  const opts = program.opts<{ preset?: string }>();
  return resolvePresets(opts.preset);
}

// ============================================================
// Seed Counters
// ============================================================
interface SeedCounters {
  categories: number;
  products: number;
  productUnits: number;
  batches: number;
  inventoryMovements: number;
}

// ============================================================
// Main
// ============================================================

const initializeDatabase = async (): Promise<void> => {
  // --- Parse CLI preset(s) ---
  const selectedKeys = parseCliPresets();
  console.log(
    `\n🎯 Selected preset(s): ${selectedKeys.map((k: PresetKey) => PRESETS[k].label).join(", ")}`,
  );
  console.log("🌱 Seeding comprehensive test data...\n");

  // --- Initialize repositories and use cases ---
  const userRepo = new UserRepository(db);
  const productRepo = new ProductRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const inventoryRepo = new InventoryRepository(db);
  const barcodeRepo = new BarcodeRepository(db);
  const accountingRepo = new AccountingRepository(db);

  const createCategoryUseCase = new CreateCategoryUseCase(categoryRepo);
  const createProductUseCase = new CreateProductUseCase(productRepo);
  const createUserUseCase = new CreateUserUseCase(userRepo);
  const adjustStockUseCase = new AdjustProductStockUseCase(
    productRepo,
    inventoryRepo,
    accountingRepo,
  );

  const now = new Date();

  // ========== SETTINGS ==========
  console.log("⚙️  Setting up application settings...");
  await settingsRepo.set("default_currency", "IQD");
  await settingsRepo.set("company_name", "المتجر النموذجي");
  await settingsRepo.set("company_address", "شارع الرشيد، بغداد، العراق");
  await settingsRepo.set("company_phone", "+964770123456");
  await settingsRepo.set("tax_rate", "0");
  await settingsRepo.set("receipt_footer", "شكراً لتسوقكم معنا");
  await settingsRepo.set("low_stock_threshold", "10");
  await settingsRepo.set("app_initialized", "true");

  // ========== CURRENCY SETTINGS ==========
  console.log("💱 Currency settings...");
  try {
    await db
      .insert(currencySettings)
      .values({
        currencyCode: "IQD",
        currencyName: "دينار عراقي",
        symbol: "ع.د",
        isBaseCurrency: true,
        exchangeRate: 1,
      })
      .onConflictDoNothing();
    await db
      .insert(currencySettings)
      .values({
        currencyCode: "USD",
        currencyName: "دولار أمريكي",
        symbol: "$",
        isBaseCurrency: false,
        exchangeRate: 1480,
      })
      .onConflictDoNothing();
  } catch {
    /* already exists */
  }

  // ========== CHART OF ACCOUNTS ==========
  console.log("📚 Chart of accounts...");
  // These 8 accounts support Balance Sheet ≡ Assets = Liabilities + (Equity + Current Earnings)
  // Balance Sheet excludes reversed entries (is_reversed=1, reversal_of_id IS NOT NULL).
  // Current earnings are computed as: Revenue Net - Expense Net (from posted, non-reversed lines only).
  const accountsData = [
    { code: "1001", name: "الصندوق", accountType: "asset", parentId: null },
    { code: "1100", name: "ذمم العملاء", accountType: "asset", parentId: null },
    {
      code: "1300",
      name: "ضريبة المدخلات",
      accountType: "asset",
      parentId: null,
    },
    {
      code: "2100",
      name: "ذمم الموردين",
      accountType: "liability",
      parentId: null,
    },
    {
      code: "2200",
      name: "ضريبة المخرجات",
      accountType: "liability",
      parentId: null,
    },
    {
      code: "4001",
      name: "إيرادات المبيعات",
      accountType: "revenue",
      parentId: null,
    },
    {
      code: "5001",
      name: "تكلفة البضاعة",
      accountType: "expense",
      parentId: null,
    },
    { code: "1200", name: "المخزون", accountType: "asset", parentId: null },
  ];
  for (const acct of accountsData) {
    try {
      await db
        .insert(accounts)
        .values({
          ...acct,
          balance: 0,
          isActive: true,
          createdAt: now,
        } as any)
        .onConflictDoNothing();
    } catch {
      /* already exists */
    }
  }

  // ========== BARCODE TEMPLATE ==========
  console.log("🏷️  Barcode template...");
  const existingTemplates = await barcodeRepo.findAllTemplates();
  if (existingTemplates.length === 0) {
    await barcodeRepo.createTemplate({
      name: "قالب افتراضي",
      width: 50,
      height: 25,
      barcodeType: "CODE128",
      showPrice: true,
      showName: true,
      showBarcode: true,
      showExpiry: false,
      isDefault: true,
    });
  }

  // ========== USERS ==========
  console.log("👥 Creating users with different roles...");

  async function getOrCreateUser(userData: {
    username: string;
    password: string;
    fullName: string;
    role: "admin" | "cashier" | "manager" | "viewer";
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const existing = await userRepo.findByUsername(userData.username);
    if (existing) {
      console.log(`   ✓ User '${userData.username}' already exists`);
      return existing;
    }
    const user = await createUserUseCase.execute({
      username: userData.username,
      password: userData.password,
      fullName: userData.fullName,
      role: userData.role,
      isActive: userData.isActive,
    });
    console.log(`   ✓ Created user '${userData.username}' (${userData.role})`);
    return user;
  }

  const admin = await getOrCreateUser({
    username: "admin",
    password: "Admin@123",
    fullName: "أحمد المدير",
    role: "admin",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const manager = await getOrCreateUser({
    username: "manager",
    password: "Manager@123",
    fullName: "محمد المشرف",
    role: "manager",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const cashier1 = await getOrCreateUser({
    username: "cashier",
    password: "Cashier@123",
    fullName: "فاطمة الكاشير",
    role: "cashier",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const cashier2 = await getOrCreateUser({
    username: "cashier2",
    password: "Cashier@123",
    fullName: "سارة البائعة",
    role: "cashier",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await getOrCreateUser({
    username: "viewer",
    password: "Viewer@123",
    fullName: "علي المراقب",
    role: "viewer",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  // Rotate creators for variety
  const creators = [admin, manager, cashier1, cashier2];
  const pickCreator = (idx: number) => creators[idx % creators.length];

  // ========== HELPERS ==========

  /** Look up existing categories, create if not found */
  async function getOrCreateCategoryByName(
    name: string,
    description: string,
    createdBy: number,
  ) {
    // FIX: Await findAll result if it's async (standard Drizzle/repo pattern)
    // Note: Assuming repo methods are async-compatible (returning Promise or direct value depending on impl)
    // Using await covers both cases if it returns a value or a Promise.
    const allCategories = await categoryRepo.findAll();
    const existing = allCategories.find((c) => c.name === name);
    if (existing) return existing;
    return await createCategoryUseCase.execute({
      name,
      description,
      isActive: true,
      createdBy,
    });
  }

  /** Look up existing products by SKU, create if not found */
  async function getOrCreateProductBySku(
    data: PresetProduct,
    categoryId: number,
    createdBy: number,
  ) {
    // FIX: Await findAll result
    const { items: allProducts } = await productRepo.findAll();
    const existing = allProducts.find((p) => p.sku === data.sku);
    if (existing) return existing;
    return await createProductUseCase.execute({
      name: data.name,
      sku: data.sku,
      categoryId,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      stock: data.stock,
      minStock: data.minStock,
      unit: data.unit,
      supplier: data.supplier,
      status: data.status,
      isActive: true,
      createdBy,
    });
  }

  // ========== SEED PRESET ==========

  async function seedPreset(presetKey: PresetKey): Promise<SeedCounters> {
    const preset: Preset = PRESETS[presetKey];
    const counters: SeedCounters = {
      categories: 0,
      products: 0,
      productUnits: 0,
      batches: 0,
      inventoryMovements: 0,
    };

    console.log(`\n📦 Seeding preset: ${preset.label} (${presetKey})`);

    // --- Categories ---
    console.log("  📁 Categories...");
    const categoryMap: Record<string, { id?: number }> = {};
    for (let i = 0; i < preset.categories.length; i++) {
      const cat = preset.categories[i];
      const created = await getOrCreateCategoryByName(
        cat.name,
        cat.description,
        pickCreator(i).id!,
      );
      categoryMap[cat.name] = created;
      counters.categories++;
    }

    // --- Products ---
    console.log("  📦 Products...");
    const productMap: Record<
      string,
      {
        id: number;
        sellingPrice: number;
        costPrice: number;
        stock: number;
        units?: PresetProductUnit[];
      }
    > = {};

    for (let i = 0; i < preset.products.length; i++) {
      const prod = preset.products[i];
      const catId = categoryMap[prod.categoryRef]?.id;
      if (!catId) {
        console.warn(
          `    ⚠ Category '${prod.categoryRef}' not found for product '${prod.name}', skipping.`,
        );
        continue;
      }
      const created = await getOrCreateProductBySku(
        prod,
        catId,
        pickCreator(i).id!,
      );
      productMap[prod.sku] = {
        id: created.id!,
        sellingPrice: created.sellingPrice,
        costPrice: created.costPrice,
        stock: created.stock ?? prod.stock,
        units: prod.units,
      };
      counters.products++;
    }

    // --- Product Units (extra packaging) ---
    console.log("  📦 Product units...");
    for (const prod of preset.products) {
      if (!prod.units || prod.units.length === 0) continue;
      const prodId = productMap[prod.sku]?.id;
      if (!prodId) continue;
      for (const unitDef of prod.units) {
        try {
          await db
            .insert(productUnits)
            .values({
              productId: prodId,
              unitName: unitDef.unitName,
              factorToBase: unitDef.factorToBase,
              barcode: unitDef.barcode ?? null,
              sellingPrice: unitDef.sellingPrice ?? null,
              isDefault: false,
            } as any)
            .onConflictDoNothing();
          counters.productUnits++;
        } catch {
          /* already exists */
        }
      }
    }

    // --- Opening stock: create batch + inventory movement via AdjustProductStockUseCase ---
    console.log("  📊 Opening stock (batch + movement)...");
    for (const prod of preset.products) {
      const prodInfo = productMap[prod.sku];
      if (!prodInfo || prodInfo.stock <= 0) continue;

      // Check if an opening batch already exists for this product
      const existingBatches = await productRepo.findBatchesByProductId(
        prodInfo.id,
      );
      if (existingBatches.length > 0) continue;

      try {
        await adjustStockUseCase.executeCommitPhase(
          {
            productId: prodInfo.id,
            quantityChange: prodInfo.stock,
            reason: "opening",
            notes: "رصيد افتتاحي (بذرة البيانات)",
            createdBy: pickCreator(0).id!,
          },
          pickCreator(0).id!,
        );
        counters.batches++;
        counters.inventoryMovements++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `    ⚠ Could not create opening stock for '${prod.sku}': ${msg}`,
        );
      }
    }

    return counters;
  }

  // ========== RUN SELECTED PRESETS ==========
  const totalCounters: SeedCounters = {
    categories: 0,
    products: 0,
    productUnits: 0,
    batches: 0,
    inventoryMovements: 0,
  };

  for (const key of selectedKeys) {
    const c = await seedPreset(key);
    totalCounters.categories += c.categories;
    totalCounters.products += c.products;
    totalCounters.productUnits += c.productUnits;
    totalCounters.batches += c.batches;
    totalCounters.inventoryMovements += c.inventoryMovements;
  }

  // ========== SUMMARY ==========
  console.log("");
  console.log("✅ Database seeded successfully!");
  console.log("");
  console.log("📊 Summary:");
  console.log("   • 5 users (admin, manager, 2 cashiers, viewer)");
  console.log(`   • ${totalCounters.categories} categories`);
  console.log(`   • ${totalCounters.products} products (IQD pricing)`);
  console.log(`   • ${totalCounters.productUnits} product units (packaging)`);
  console.log(`   • ${totalCounters.batches} product batches (opening stock)`);
  console.log(`   • ${totalCounters.inventoryMovements} inventory movements`);
  console.log("   • 1 barcode template");
  console.log("   • 2 currency settings (IQD, USD)");
  console.log(
    "   • 8 chart of accounts (for Balance Sheet, P&L, Trial Balance reports)",
  );
  console.log("");
  console.log("🔑 Test credentials:");
  console.log("   Admin:    admin / Admin@123");
  console.log("   Manager:  manager / Manager@123");
  console.log("   Cashier:  cashier / Cashier@123");
  console.log("   Cashier2: cashier2 / Cashier@123");
  console.log("   Viewer:   viewer / Viewer@123");
};

// ============================================================
// EXECUTION
// ============================================================

const __filename = fileURLToPath(import.meta.url);

if (path.resolve(process.argv[1]) === path.resolve(__filename)) {
  console.log(`\n🔌 Connecting to PostgreSQL database...`);

  initializeDatabase()
    .then(async () => {
      console.log("\n✨ Seed completed.");
      await queryClient.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("\n❌ Seed failed:", err);
      await queryClient.end();
      process.exit(1);
    });
}

export { initializeDatabase };
