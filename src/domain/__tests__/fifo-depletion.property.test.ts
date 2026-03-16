/**
 * Property-based tests for FIFO/FEFO batch depletion logic.
 *
 * These tests verify the core ordering and quantity invariants that the
 * FifoService must uphold, using fast-check to generate random batch
 * configurations and sale quantities.
 *
 * We test a pure in-memory version of the depletion algorithm to isolate
 * the business logic from the database layer.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { InsufficientStockError } from "../shared/errors/DomainErrors.js";

// ── Pure depletion logic (mirrors FifoService ordering) ─────────────────────

interface TestBatch {
  id: number;
  expiryDate: string | null; // ISO date string or null
  quantityOnHand: number;
  costPerUnit: number;
}

interface Depletion {
  batchId: number;
  quantity: number;
}

function sortBatches(batches: TestBatch[]): TestBatch[] {
  return [...batches].sort((a, b) => {
    // 1. Batches with expiry before those without
    const aHasExpiry = a.expiryDate !== null ? 0 : 1;
    const bHasExpiry = b.expiryDate !== null ? 0 : 1;
    if (aHasExpiry !== bHasExpiry) return aHasExpiry - bHasExpiry;

    // 2. Earliest expiry first (FEFO)
    if (a.expiryDate && b.expiryDate) {
      const cmp = a.expiryDate.localeCompare(b.expiryDate);
      if (cmp !== 0) return cmp;
    }

    // 3. Lowest batch ID first (FIFO)
    return a.id - b.id;
  });
}

function deplete(
  batches: TestBatch[],
  quantityNeeded: number,
): Depletion[] {
  const totalAvailable = batches.reduce((s, b) => s + b.quantityOnHand, 0);
  if (totalAvailable < quantityNeeded) {
    throw new InsufficientStockError(
      `Insufficient stock: need ${quantityNeeded}, have ${totalAvailable}`,
      { available: totalAvailable, requested: quantityNeeded },
    );
  }

  const sorted = sortBatches(batches.filter((b) => b.quantityOnHand > 0));
  const depletions: Depletion[] = [];
  let remaining = quantityNeeded;

  for (const batch of sorted) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, batch.quantityOnHand);
    depletions.push({ batchId: batch.id, quantity: taken });
    remaining -= taken;
  }

  return depletions;
}

// ── Arbitraries ──────────────────────────────────────────────────────────────

const batchArb = fc
  .record({
    id: fc.integer({ min: 1, max: 10_000 }),
    expiryDate: fc.option(
      fc
        .date({
          min: new Date("2024-01-01"),
          max: new Date("2030-12-31"),
          noInvalidDate: true,
        })
        .map((d) => d.toISOString().slice(0, 10)), // YYYY-MM-DD
      { nil: null },
    ),
    quantityOnHand: fc.integer({ min: 0, max: 500 }),
    costPerUnit: fc.integer({ min: 1, max: 100_000 }),
  })
  .filter((b) => b.id >= 1);

const batchListArb = fc
  .array(batchArb, { minLength: 1, maxLength: 20 })
  .map((batches) => {
    // Ensure unique IDs
    const seen = new Set<number>();
    return batches.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  })
  .filter((list) => list.length >= 1);

// ── Tests ────────────────────────────────────────────────────────────────────

describe("FIFO Depletion — property-based tests", () => {
  it("Invariant 1: batches with expiry are depleted before those without", () => {
    fc.assert(
      fc.property(batchListArb, fc.integer({ min: 1, max: 10 }), (batches, qty) => {
        const activeBatches = batches.filter((b) => b.quantityOnHand > 0);
        const hasExpiry = activeBatches.filter((b) => b.expiryDate !== null);
        const noExpiry = activeBatches.filter((b) => b.expiryDate === null);

        if (hasExpiry.length === 0 || noExpiry.length === 0) return true; // Skip

        const totalHasExpiry = hasExpiry.reduce(
          (s, b) => s + b.quantityOnHand,
          0,
        );
        if (qty > totalHasExpiry) return true; // Not enough to test order

        try {
          const depletions = deplete(batches, qty);
          const depleted = new Set(depletions.map((d) => d.batchId));

          // All depleted batches should be from the expiry group
          for (const batchId of depleted) {
            const batch = batches.find((b) => b.id === batchId)!;
            expect(batch.expiryDate).not.toBeNull();
          }
          return true;
        } catch (e) {
          if (e instanceof InsufficientStockError) return true;
          throw e;
        }
      }),
    );
  });

  it("Invariant 2: among dated batches, earliest expiry is depleted first", () => {
    fc.assert(
      fc.property(batchListArb, fc.integer({ min: 1, max: 50 }), (batches, qty) => {
        const datedBatches = batches.filter(
          (b) => b.expiryDate !== null && b.quantityOnHand > 0,
        );
        if (datedBatches.length < 2) return true;

        try {
          const depletions = deplete(batches, qty);
          const sorted = sortBatches(datedBatches);

          // Find the first depleted dated batch in sorted order
          for (const sortedBatch of sorted) {
            const depletion = depletions.find(
              (d) => d.batchId === sortedBatch.id,
            );
            if (!depletion) continue;

            // Verify no batch with an earlier expiry was skipped
            for (const earlier of sorted) {
              if (earlier.id === sortedBatch.id) break;
              const earlierDepletion = depletions.find(
                (d) => d.batchId === earlier.id,
              );
              // Earlier batch should be fully depleted or also depleted
              if (earlierDepletion === undefined) {
                // It was skipped — this is only OK if it had 0 stock
                expect(earlier.quantityOnHand).toBe(0);
              }
            }
            break;
          }
          return true;
        } catch (e) {
          if (e instanceof InsufficientStockError) return true;
          throw e;
        }
      }),
    );
  });

  it("Invariant 3: among same-expiry batches, lowest batch ID is depleted first", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 1, max: 200 }),
        (qty1, qty2) => {
          const sharedExpiry = "2026-06-15";
          const batches: TestBatch[] = [
            { id: 10, expiryDate: sharedExpiry, quantityOnHand: qty1, costPerUnit: 100 },
            { id: 5, expiryDate: sharedExpiry, quantityOnHand: qty2, costPerUnit: 100 },
          ];

          // Request only up to qty2 (the batch with lower id=5)
          const requestQty = Math.min(qty2, qty1 + qty2);
          if (requestQty === 0) return true;

          try {
            const depletions = deplete(batches, requestQty);
            // Batch id=5 must be depleted first
            if (depletions.length > 0) {
              expect(depletions[0].batchId).toBe(5);
            }
            return true;
          } catch (e) {
            if (e instanceof InsufficientStockError) return true;
            throw e;
          }
        },
      ),
    );
  });

  it("Invariant 4: total depleted quantity equals the requested quantity", () => {
    fc.assert(
      fc.property(batchListArb, fc.integer({ min: 1, max: 200 }), (batches, qty) => {
        try {
          const depletions = deplete(batches, qty);
          const totalDepleted = depletions.reduce((s, d) => s + d.quantity, 0);
          expect(totalDepleted).toBe(qty);
          return true;
        } catch (e) {
          if (e instanceof InsufficientStockError) return true;
          throw e;
        }
      }),
    );
  });

  it("Invariant 5: InsufficientStockError iff total available < requested", () => {
    fc.assert(
      fc.property(batchListArb, fc.integer({ min: 1, max: 500 }), (batches, qty) => {
        const totalAvailable = batches.reduce(
          (s, b) => s + b.quantityOnHand,
          0,
        );

        if (qty > totalAvailable) {
          expect(() => deplete(batches, qty)).toThrow(InsufficientStockError);
        } else {
          expect(() => deplete(batches, qty)).not.toThrow();
        }
        return true;
      }),
    );
  });
});
