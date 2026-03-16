/**
 * Unit tests for ReconcileJournalLinesUseCase
 *
 * Focuses on the partial reconciliation safety constraints introduced to
 * prevent a journal line's balance from being applied more than once.
 */

import { describe, expect, test, vi } from "vitest";
import { ReconcileJournalLinesUseCase } from "../../../src/domain/use-cases/accounting/ReconcileJournalLinesUseCase.ts";
import type { IReconciliationRepository } from "../../../src/domain/interfaces/IReconciliationRepository.ts";
import type { ReconciliableJournalLine } from "../../../src/domain/entities/Reconciliation.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLine(
  overrides: Partial<ReconciliableJournalLine> & { id: number },
): ReconciliableJournalLine {
  return {
    journalEntryId: 1,
    accountId: 10,
    accountCode: "1100",
    partnerId: 5,
    debit: 0,
    credit: 0,
    balance: 0,
    description: null,
    reconciled: false,
    reconciliationId: null,
    ...overrides,
  };
}

function makeRepo(lines: ReconciliableJournalLine[]): IReconciliationRepository {
  const createdRecon = { id: 99, type: "customer" as const, status: "paid" as const, notes: null, createdBy: 1 };
  return {
    findJournalLinesByIds: vi.fn(async (ids: number[]) =>
      lines.filter((l) => ids.includes(l.id)),
    ),
    findUnreconciledLinesByPartner: vi.fn(async () => []),
    findUnreconciledLinesByAccount: vi.fn(async () => []),
    createReconciliation: vi.fn(async () => createdRecon),
    createReconciliationLines: vi.fn(async () => []),
    findReconciliationById: vi.fn(async () => null),
    findReconciliations: vi.fn(async () => ({ items: [], total: 0 })),
    markLinesReconciled: vi.fn(async () => {}),
    markLinesUnreconciled: vi.fn(async () => {}),
    deleteReconciliationLines: vi.fn(async () => {}),
    deleteReconciliation: vi.fn(async () => {}),
    getCustomerLedger: vi.fn(async () => ({
      partnerId: 5,
      partnerName: "Test",
      lines: [],
      totalDebit: 0,
      totalCredit: 0,
      outstandingBalance: 0,
    })),
    getSupplierLedger: vi.fn(async () => ({
      partnerId: 5,
      partnerName: "Test",
      lines: [],
      totalDebit: 0,
      totalCredit: 0,
      outstandingBalance: 0,
    })),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReconcileJournalLinesUseCase – partial reconciliation safety", () => {
  test("rejects a line whose remainingBalance is 0 (fully applied in prior reconciliations)", async () => {
    const debitLine = makeLine({ id: 1, debit: 1000, credit: 0, balance: 1000, remainingBalance: 1000 });
    const creditLine = makeLine({ id: 2, debit: 0, credit: 1000, balance: -1000, remainingBalance: 0 });

    const repo = makeRepo([debitLine, creditLine]);
    const uc = new ReconcileJournalLinesUseCase(repo as any);

    await expect(
      uc.execute({ journalLineIds: [1, 2] }, "1"),
    ).rejects.toThrow("no remaining balance available for reconciliation");
  });

  test("caps override amount at remainingBalance (not abs(balance)) and rejects excess", async () => {
    // Line 2 originally had balance 1000 but 700 was already applied → remaining = 300
    const debitLine = makeLine({ id: 1, debit: 300, credit: 0, balance: 300, remainingBalance: 300 });
    const creditLine = makeLine({ id: 2, debit: 0, credit: 1000, balance: -1000, remainingBalance: 300 });

    const repo = makeRepo([debitLine, creditLine]);
    const uc = new ReconcileJournalLinesUseCase(repo as any);

    // Attempting to apply 500 to line 2 must fail because remaining is 300
    await expect(
      uc.execute({ journalLineIds: [1, 2], amounts: [300, 500] }, "1"),
    ).rejects.toThrow("exceeds remaining balance 300");
  });

  test("accepts override amount equal to remainingBalance and marks that line reconciled", async () => {
    const debitLine = makeLine({ id: 1, debit: 300, credit: 0, balance: 300, remainingBalance: 300 });
    // Line 2 had balance 1000, 700 already applied → remaining = 300
    const creditLine = makeLine({ id: 2, debit: 0, credit: 1000, balance: -1000, remainingBalance: 300 });

    const repo = makeRepo([debitLine, creditLine]);
    const uc = new ReconcileJournalLinesUseCase(repo as any);

    const result = await uc.execute({ journalLineIds: [1, 2], amounts: [300, 300] }, "1");

    expect(result.matchType).toBe("full");
    // Both lines are fully consumed — markLinesReconciled should include both
    expect(repo.markLinesReconciled).toHaveBeenCalledWith([1, 2], 99);
  });

  test("uses remainingBalance as effective amount when no override is provided", async () => {
    // Line 2 has 700 already applied, only 300 left
    const debitLine = makeLine({ id: 1, debit: 300, credit: 0, balance: 300, remainingBalance: 300 });
    const creditLine = makeLine({ id: 2, debit: 0, credit: 1000, balance: -1000, remainingBalance: 300 });

    const repo = makeRepo([debitLine, creditLine]);
    const uc = new ReconcileJournalLinesUseCase(repo as any);

    const result = await uc.execute({ journalLineIds: [1, 2] }, "1");

    // Effective amounts should both be 300 (from remainingBalance), giving full match
    expect(result.matchType).toBe("full");
    expect(result.debitTotal).toBe(300);
    expect(result.creditTotal).toBe(300);
  });

  test("partial result: credit remaining 200 < debit 300 — matchType is partial", async () => {
    const debitLine = makeLine({ id: 1, debit: 300, credit: 0, balance: 300, remainingBalance: 300 });
    const creditLine = makeLine({ id: 2, debit: 0, credit: 1000, balance: -1000, remainingBalance: 200 });

    const repo = makeRepo([debitLine, creditLine]);
    const uc = new ReconcileJournalLinesUseCase(repo as any);

    // Apply only 200 of the debit (override), matching the 200 credit remaining
    const result = await uc.execute({ journalLineIds: [1, 2], amounts: [200, 200] }, "1");
    expect(result.matchType).toBe("full");

    // Now test without override — debit gets 300 applied (its full remaining) vs 200 credit
    const repo2 = makeRepo([debitLine, creditLine]);
    const uc2 = new ReconcileJournalLinesUseCase(repo2 as any);
    const result2 = await uc2.execute({ journalLineIds: [1, 2] }, "1");
    expect(result2.matchType).toBe("partial");
    expect(result2.debitTotal).toBe(300);
    expect(result2.creditTotal).toBe(200);
  });

  test("falls back to abs(balance) when remainingBalance is not populated", async () => {
    // No remainingBalance set (simulates old repo behavior / mock without the field)
    const debitLine = makeLine({ id: 1, debit: 500, credit: 0, balance: 500 });
    const creditLine = makeLine({ id: 2, debit: 0, credit: 500, balance: -500 });

    const repo = makeRepo([debitLine, creditLine]);
    const uc = new ReconcileJournalLinesUseCase(repo as any);

    const result = await uc.execute({ journalLineIds: [1, 2] }, "1");
    expect(result.matchType).toBe("full");
    expect(result.debitTotal).toBe(500);
    expect(result.creditTotal).toBe(500);
  });
});
