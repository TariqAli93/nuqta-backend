/**
 * Tests for product unit factor stock normalization.
 *
 * Rule: all persisted stock quantities must be in base units only.
 * When a user enters a quantity in a non-base unit (e.g. "box" with factor 10),
 * the server must multiply by the unit factor before touching any batch, stock
 * cache, inventory movement, or cost calculation.
 *
 * Cases verified:
 *  - Positive stock adjustment with factor converts to base units
 *  - Negative stock adjustment with factor converts to base units
 *  - No unit factor provided defaults to factor = 1 (backward compat)
 *  - Invalid unitFactor (< 1) is rejected with ValidationError
 *  - Inventory movement stores base quantity, not display quantity
 *  - Journal cost uses base quantity
 *  - Purchase creation always computes quantityBase server-side (ignores client value)
 *  - Purchase with explicit factor produces correct quantityBase
 *  - Purchase with invalid unitFactor is rejected
 */

import { describe, expect, test, vi } from "vitest";
import { AdjustProductStockUseCase } from "../../../src/domain/use-cases/products/AdjustProductStockUseCase.js";
import { CreatePurchaseUseCase } from "../../../src/domain/use-cases/purchases/CreatePurchaseUseCase.js";
import { ValidationError, InsufficientStockError } from "../../../src/domain/shared/errors/DomainErrors.js";

// ─── AdjustProductStockUseCase mock builder ──────────────────────────────────

function buildAdjustDeps(opts?: {
  initialStock?: number;
  batchQuantityOnHand?: number;
}) {
  const product = {
    id: 1,
    name: "Widget",
    stock: opts?.initialStock ?? 100,
    costPrice: 500,
    unit: "piece",
    status: "available",
  };

  const batch = {
    id: 10,
    productId: 1,
    batchNumber: "B-001",
    quantityOnHand: opts?.batchQuantityOnHand ?? 100,
    costPerUnit: 500,
    status: "active",
  };

  // Track what values are passed to the mocked repo calls
  const calls = {
    updateBatchStock: [] as { batchId: number; delta: number }[],
    createBatch: [] as any[],
    setStock: [] as { id: number; stock: number }[],
    createMovementSync: [] as any[],
  };

  const productRepo = {
    findById: vi.fn(async () => product),
    findBatchById: vi.fn(async () => ({ ...batch })),
    updateBatchStock: vi.fn(async (batchId: number, delta: number) => {
      calls.updateBatchStock.push({ batchId, delta });
      batch.quantityOnHand += delta;
    }),
    createBatch: vi.fn(async (b: any) => {
      calls.createBatch.push(b);
      return { ...b, id: 20 };
    }),
    findBatchesByProductId: vi.fn(async () => [{ ...batch }]),
    setStock: vi.fn(async (id: number, stock: number) => {
      calls.setStock.push({ id, stock });
      product.stock = stock;
    }),
    update: vi.fn(async () => {}),
  };

  const movements: any[] = [];
  const inventoryRepo = {
    createMovementSync: vi.fn(async (m: any) => {
      const movement = { ...m, id: 99 };
      calls.createMovementSync.push(movement);
      movements.push(movement);
      return movement;
    }),
  };

  // Minimal accounting repo that returns no accounts → journal skipped
  const accountingRepo = {
    findAccountByCode: vi.fn(async () => null),
    createJournalEntrySync: vi.fn(async () => ({ id: 1 })),
  };

  const uc = new AdjustProductStockUseCase(
    productRepo as any,
    inventoryRepo as any,
    accountingRepo as any,
  );

  return { uc, productRepo, inventoryRepo, accountingRepo, calls, product, batch, movements };
}

// ─── CreatePurchaseUseCase mock builder ──────────────────────────────────────

function buildPurchaseDeps() {
  const purchaseRepo = {
    findByIdempotencyKey: vi.fn(async () => null),
    createSync: vi.fn(async (p: any) => ({ ...p, id: 100 })),
  };

  const supplierRepo = {
    findById: vi.fn(async () => ({ id: 5, name: "Supplier", currentBalance: 0 })),
    updatePayable: vi.fn(async () => {}),
  };

  const paymentRepo = {
    createSync: vi.fn(async (p: any) => ({ id: 200, ...p })),
  };

  const supplierLedgerRepo = {
    getLastBalanceSync: vi.fn(async () => 0),
    createSync: vi.fn(async (e: any) => ({ id: 1, ...e })),
  };

  const accountingRepo = {
    findAccountByCode: vi.fn(async () => null),
    createJournalEntrySync: vi.fn(async () => ({ id: 1 })),
  };

  const settingsRepo = {
    get: vi.fn(async (key: string) => {
      if (key === "modules.accounting.enabled") return "false";
      if (key === "modules.ledgers.enabled") return "false";
      return null;
    }),
  };

  const mockDb = { transaction: (fn: any) => fn(mockDb) } as any;

  const uc = new CreatePurchaseUseCase(
    mockDb,
    purchaseRepo as any,
    supplierRepo as any,
    paymentRepo as any,
    supplierLedgerRepo as any,
    accountingRepo as any,
    settingsRepo as any,
  );

  return { uc, purchaseRepo };
}

// ─── Tests: AdjustProductStockUseCase ────────────────────────────────────────

describe("AdjustProductStockUseCase — unit factor normalization", () => {
  test("positive adjustment with factor 10 (box): batch receives base quantity (50)", async () => {
    const { uc, calls } = buildAdjustDeps({ initialStock: 0, batchQuantityOnHand: 0 });

    // User enters: +5 boxes, factor = 10 → base = 50
    await uc.executeCommitPhase(
      { productId: 1, quantityChange: 5, unitName: "box", unitFactor: 10, batchId: 10 },
      "1",
    );

    // Batch must be updated with 50 (base units), not 5 (display units)
    expect(calls.updateBatchStock).toHaveLength(1);
    expect(calls.updateBatchStock[0].delta).toBe(50);
  });

  test("positive adjustment with factor 10: inventory movement stores quantityBase = 50", async () => {
    const { uc, calls } = buildAdjustDeps({ initialStock: 0, batchQuantityOnHand: 0 });

    await uc.executeCommitPhase(
      { productId: 1, quantityChange: 5, unitName: "box", unitFactor: 10, batchId: 10 },
      "1",
    );

    expect(calls.createMovementSync).toHaveLength(1);
    const movement = calls.createMovementSync[0];
    expect(movement.quantityBase).toBe(50);   // base units
    expect(movement.unitFactor).toBe(10);
    expect(movement.unitName).toBe("box");
  });

  test("negative adjustment with factor 10 (box): batch decreases by base quantity (20)", async () => {
    // Initial: 100 pieces in batch (= 10 boxes)
    const { uc, calls } = buildAdjustDeps({ initialStock: 100, batchQuantityOnHand: 100 });

    // User enters: -2 boxes, factor = 10 → base = -20
    await uc.executeCommitPhase(
      { productId: 1, quantityChange: -2, unitName: "box", unitFactor: 10, batchId: 10 },
      "1",
    );

    expect(calls.updateBatchStock).toHaveLength(1);
    expect(calls.updateBatchStock[0].delta).toBe(-20); // base units
  });

  test("negative adjustment with factor 10: movement stores quantityBase = -20", async () => {
    const { uc, calls } = buildAdjustDeps({ initialStock: 100, batchQuantityOnHand: 100 });

    await uc.executeCommitPhase(
      { productId: 1, quantityChange: -2, unitName: "box", unitFactor: 10, batchId: 10 },
      "1",
    );

    const movement = calls.createMovementSync[0];
    expect(movement.quantityBase).toBe(-20);
  });

  test("no unitFactor provided: defaults to 1 (backward compatibility)", async () => {
    const { uc, calls } = buildAdjustDeps({ initialStock: 0, batchQuantityOnHand: 0 });

    // No unitFactor → factor defaults to 1, base = display
    await uc.executeCommitPhase(
      { productId: 1, quantityChange: 7, batchId: 10 },
      "1",
    );

    expect(calls.updateBatchStock[0].delta).toBe(7); // unchanged
    expect(calls.createMovementSync[0].quantityBase).toBe(7);
    expect(calls.createMovementSync[0].unitFactor).toBe(1);
  });

  test("unitFactor = 1 explicitly: behaves identically to no unitFactor", async () => {
    const { uc, calls } = buildAdjustDeps({ initialStock: 0, batchQuantityOnHand: 0 });

    await uc.executeCommitPhase(
      { productId: 1, quantityChange: 3, unitFactor: 1, batchId: 10 },
      "1",
    );

    expect(calls.updateBatchStock[0].delta).toBe(3);
    expect(calls.createMovementSync[0].quantityBase).toBe(3);
  });

  test("unitFactor < 1 is rejected with ValidationError", async () => {
    const { uc } = buildAdjustDeps();

    await expect(
      uc.executeCommitPhase(
        { productId: 1, quantityChange: 5, unitFactor: 0, batchId: 10 },
        "1",
      ),
    ).rejects.toThrow(ValidationError);

    await expect(
      uc.executeCommitPhase(
        { productId: 1, quantityChange: 5, unitFactor: -1, batchId: 10 },
        "1",
      ),
    ).rejects.toThrow(ValidationError);
  });

  test("auto-batch creation (no batchId): new batch gets base quantity (50)", async () => {
    const { uc, calls, productRepo } = buildAdjustDeps({ initialStock: 0, batchQuantityOnHand: 0 });

    // Make findBatchesByProductId return the newly created batch
    productRepo.findBatchesByProductId.mockResolvedValue([
      { id: 20, productId: 1, quantityOnHand: 50, status: "active" },
    ]);

    await uc.executeCommitPhase(
      { productId: 1, quantityChange: 5, unitFactor: 10 /* no batchId */ },
      "1",
    );

    // A new batch should be created with base quantities
    expect(calls.createBatch).toHaveLength(1);
    expect(calls.createBatch[0].quantityReceived).toBe(50);
    expect(calls.createBatch[0].quantityOnHand).toBe(50);
  });

  test("auto-find batch for negative (no batchId): compares base quantity to batch stock", async () => {
    // Batch has 30 pieces. Removing 2 boxes (factor 10) = 20 pieces → should succeed.
    const { uc, calls, productRepo } = buildAdjustDeps({ initialStock: 30, batchQuantityOnHand: 30 });

    productRepo.findBatchesByProductId.mockResolvedValue([
      { id: 10, productId: 1, quantityOnHand: 30, status: "active" },
    ]);

    await uc.executeCommitPhase(
      { productId: 1, quantityChange: -2, unitFactor: 10 },
      "1",
    );

    expect(calls.updateBatchStock[0].delta).toBe(-20); // base units
  });

  test("auto-find batch: insufficient batch stock uses base quantity in comparison", async () => {
    // Batch has 15 pieces. Removing 2 boxes (factor 10) = 20 pieces → must fail.
    const { uc, productRepo } = buildAdjustDeps({ initialStock: 15, batchQuantityOnHand: 15 });

    productRepo.findBatchesByProductId.mockResolvedValue([
      { id: 10, productId: 1, quantityOnHand: 15, status: "active" },
    ]);

    await expect(
      uc.executeCommitPhase(
        { productId: 1, quantityChange: -2, unitFactor: 10 },
        "1",
      ),
    ).rejects.toThrow(InsufficientStockError);
  });

  test("totalCost in movement uses base quantity (50 × costPrice)", async () => {
    // costPrice = 500, adjustment = +5 boxes × factor 10 = 50 base
    // expected totalCost = 50 × 500 = 25000
    const { uc, calls } = buildAdjustDeps({ initialStock: 0, batchQuantityOnHand: 0 });

    await uc.executeCommitPhase(
      { productId: 1, quantityChange: 5, unitFactor: 10, batchId: 10 },
      "1",
    );

    expect(calls.createMovementSync[0].totalCost).toBe(25000); // 50 × 500
  });
});

// ─── Tests: CreatePurchaseUseCase ────────────────────────────────────────────

describe("CreatePurchaseUseCase — server-authoritative quantityBase", () => {
  test("purchase of 4 packs (factor 6) produces quantityBase = 24", async () => {
    const { uc, purchaseRepo } = buildPurchaseDeps();

    await uc.executeCommitPhase(
      {
        invoiceNumber: "PUR-001",
        supplierId: 5,
        items: [
          {
            productId: 1,
            quantity: 4,
            unitFactor: 6,
            unitName: "pack",
            unitCost: 1000,
          },
        ],
      },
      "1",
    );

    const persistedItems = purchaseRepo.createSync.mock.calls[0][0].items;
    expect(persistedItems[0].quantityBase).toBe(24); // 4 × 6
    expect(persistedItems[0].unitFactor).toBe(6);
  });

  test("client-supplied quantityBase is IGNORED; server always recomputes", async () => {
    const { uc, purchaseRepo } = buildPurchaseDeps();

    await uc.executeCommitPhase(
      {
        invoiceNumber: "PUR-002",
        supplierId: 5,
        items: [
          {
            productId: 1,
            quantity: 4,
            unitFactor: 6,
            unitName: "pack",
            unitCost: 1000,
            // Client claims quantityBase = 5 (wrong — should be 24)
            quantityBase: 5,
          },
        ],
      },
      "1",
    );

    const persistedItems = purchaseRepo.createSync.mock.calls[0][0].items;
    // Must be 24 (4 × 6), not the client-supplied 5
    expect(persistedItems[0].quantityBase).toBe(24);
    expect(persistedItems[0].quantityBase).not.toBe(5);
  });

  test("no unitFactor defaults to 1: quantityBase = quantity", async () => {
    const { uc, purchaseRepo } = buildPurchaseDeps();

    await uc.executeCommitPhase(
      {
        invoiceNumber: "PUR-003",
        supplierId: 5,
        items: [{ productId: 1, quantity: 7, unitCost: 500 }],
      },
      "1",
    );

    const persistedItems = purchaseRepo.createSync.mock.calls[0][0].items;
    expect(persistedItems[0].unitFactor).toBe(1);
    expect(persistedItems[0].quantityBase).toBe(7);
  });

  test("unitFactor < 1 is rejected with ValidationError", async () => {
    const { uc } = buildPurchaseDeps();

    await expect(
      uc.executeCommitPhase(
        {
          invoiceNumber: "PUR-004",
          supplierId: 5,
          items: [{ productId: 1, quantity: 3, unitFactor: 0, unitCost: 500 }],
        },
        "1",
      ),
    ).rejects.toThrow(ValidationError);
  });
});
