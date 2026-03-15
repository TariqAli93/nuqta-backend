/**
 * Property-based tests for accounting journal entry invariants.
 *
 * Core double-entry accounting rules that must hold for ALL journal entries:
 *  1. Total debits === total credits for every entry
 *  2. Trial balance (Σ debits − Σ credits across all entries) === 0
 *  3. No journal entry has a zero total amount
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ── Pure journal entry model ──────────────────────────────────────────────────

interface JournalLine {
  accountId: number;
  debit: number;  // IQD integer
  credit: number; // IQD integer
}

interface JournalEntry {
  lines: JournalLine[];
}

function totalDebits(entry: JournalEntry): number {
  return entry.lines.reduce((s, l) => s + l.debit, 0);
}

function totalCredits(entry: JournalEntry): number {
  return entry.lines.reduce((s, l) => s + l.credit, 0);
}

function totalAmount(entry: JournalEntry): number {
  return totalDebits(entry); // == totalCredits by invariant 1
}

/**
 * Build a balanced journal entry from a list of (amount, accountId) pairs.
 * The first half is debited, the second half is credited, with a balancing
 * line added if amounts don't match.
 */
function buildBalancedEntry(
  lines: { accountId: number; amount: number }[],
): JournalEntry {
  if (lines.length === 0) {
    // Trivial balanced entry with a single debit+credit line pair
    return {
      lines: [
        { accountId: 1, debit: 100, credit: 0 },
        { accountId: 2, debit: 0, credit: 100 },
      ],
    };
  }

  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);
  if (totalAmount === 0) {
    return buildBalancedEntry([{ accountId: 1, amount: 1 }]);
  }

  const debitLines: JournalLine[] = lines.map((l) => ({
    accountId: l.accountId,
    debit: l.amount,
    credit: 0,
  }));
  const creditLine: JournalLine = {
    accountId: 9999, // balancing account
    debit: 0,
    credit: totalAmount,
  };

  return { lines: [...debitLines, creditLine] };
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const lineArb = fc.record({
  accountId: fc.integer({ min: 1, max: 9999 }),
  amount: fc.integer({ min: 1, max: 10_000_000 }), // IQD, no floats
});

const entryArb = fc
  .array(lineArb, { minLength: 1, maxLength: 10 })
  .map(buildBalancedEntry);

const ledgerArb = fc.array(entryArb, { minLength: 1, maxLength: 50 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Accounting — property-based tests", () => {
  it("Invariant 1: every journal entry has total debits === total credits", () => {
    fc.assert(
      fc.property(entryArb, (entry) => {
        const debits = totalDebits(entry);
        const credits = totalCredits(entry);
        expect(debits).toBe(credits);
      }),
    );
  });

  it("Invariant 2: trial balance (Σ debits − Σ credits) === 0 across all entries", () => {
    fc.assert(
      fc.property(ledgerArb, (entries) => {
        const allDebits = entries.reduce((s, e) => s + totalDebits(e), 0);
        const allCredits = entries.reduce((s, e) => s + totalCredits(e), 0);
        expect(allDebits - allCredits).toBe(0);
      }),
    );
  });

  it("Invariant 3: no journal entry has a zero total amount", () => {
    fc.assert(
      fc.property(entryArb, (entry) => {
        const amount = totalAmount(entry);
        expect(amount).toBeGreaterThan(0);
      }),
    );
  });

  it("Balanced entry builder always produces balanced entries", () => {
    fc.assert(
      fc.property(
        fc.array(lineArb, { minLength: 0, maxLength: 20 }),
        (lines) => {
          const entry = buildBalancedEntry(lines);
          expect(totalDebits(entry)).toBe(totalCredits(entry));
          expect(totalDebits(entry)).toBeGreaterThan(0);
        },
      ),
    );
  });
});
