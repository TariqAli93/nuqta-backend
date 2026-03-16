/**
 * ReconcileJournalLinesUseCase
 *
 * Core ERP reconciliation engine.  Operates exclusively on journal entry lines,
 * never directly on invoices or payments.
 *
 * Algorithm:
 *  1. Fetch the requested journal lines.
 *  2. Validate they all share the same account and partner.
 *  3. Separate debit lines (invoices / charges) from credit lines (payments / credits).
 *  4. Determine match type:
 *       full       — sum(debits) == sum(credits)          [e.g. invoice fully paid]
 *       partial    — sum(credits) < sum(debits)           [partial payment]
 *       overpayment — sum(credits) > sum(debits)          [credit exceeds charge]
 *  5. Build a reconciliation record + lines.
 *  6. Mark journal lines as reconciled.
 *
 * Partial reconciliation support:
 *  When caller passes `amounts[]`, each amount overrides the full balance of the
 *  corresponding line.  This lets the engine reconcile a part of a line without
 *  touching the original journal entry (which is immutable once posted).
 */

import type { IReconciliationRepository } from "../../interfaces/IReconciliationRepository.js";
import type { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import type {
  ReconcileInput,
  ReconciliationResult,
  ReconciliableJournalLine,
} from "../../entities/Reconciliation.js";
import { ValidationError, NotFoundError } from "../../shared/errors/DomainErrors.js";
import { AuditService } from "../../shared/services/AuditService.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type CommitResult = ReconciliationResult;

export class ReconcileJournalLinesUseCase extends WriteUseCase<
  ReconcileInput,
  CommitResult,
  ReconciliationResult
> {
  private auditService?: AuditService;

  constructor(
    private reconRepo: IReconciliationRepository,
    auditRepo?: IAuditRepository,
  ) {
    super();
    if (auditRepo) this.auditService = new AuditService(auditRepo);
  }

  async executeCommitPhase(
    input: ReconcileInput,
    userId: string,
  ): Promise<CommitResult> {
    const numUserId = Number(userId) || 0;

    // ── 1. Fetch lines ────────────────────────────────────────────────────
    if (!input.journalLineIds || input.journalLineIds.length < 2) {
      throw new ValidationError(
        "At least two journal line IDs are required for reconciliation",
      );
    }

    // Reject duplicate IDs up-front to avoid confusing not-found behavior
    const uniqueIds = new Set(input.journalLineIds);
    if (uniqueIds.size !== input.journalLineIds.length) {
      const duplicateIds = [
        ...new Set(
          input.journalLineIds.filter(
            (id, index, arr) => arr.indexOf(id) !== index,
          ),
        ),
      ];
      throw new ValidationError(
        `Duplicate journal line IDs are not allowed: ${duplicateIds.join(", ")}`,
        { duplicateIds },
      );
    }

    const lines = await this.reconRepo.findJournalLinesByIds(
      input.journalLineIds,
    );

    if (lines.length !== input.journalLineIds.length) {
      const found = new Set(lines.map((l) => l.id));
      const missing = input.journalLineIds.filter((id) => !found.has(id));
      throw new NotFoundError(
        `Journal lines not found: ${missing.join(", ")}`,
        { missing },
      );
    }

    // ── 2. Validate homogeneity ───────────────────────────────────────────
    this._validateHomogeneity(lines);

    // ── 3. Check for already-reconciled lines ────────────────────────────
    const alreadyReconciled = lines.filter((l) => l.reconciled);
    if (alreadyReconciled.length > 0) {
      throw new ValidationError(
        `Lines already reconciled: ${alreadyReconciled.map((l) => l.id).join(", ")}. ` +
          "Unreconcile first before creating a new reconciliation.",
        { lineIds: alreadyReconciled.map((l) => l.id) },
      );
    }

    // ── 4. Resolve effective amounts ──────────────────────────────────────
    const effectiveAmounts: number[] = input.journalLineIds.map((id, idx) => {
      const line = lines.find((l) => l.id === id)!;
      const overrideAmt = input.amounts?.[idx];
      if (overrideAmt !== undefined) {
        const maxAmt = Math.abs(line.balance);
        if (overrideAmt <= 0) {
          throw new ValidationError(
            `Amount at index ${idx} must be positive`,
          );
        }
        if (overrideAmt > maxAmt) {
          throw new ValidationError(
            `Amount ${overrideAmt} at index ${idx} exceeds line balance ${maxAmt}`,
          );
        }
        return overrideAmt;
      }
      return Math.abs(line.balance);
    });

    // ── 5. Separate debits from credits ───────────────────────────────────
    let debitTotal = 0;
    let creditTotal = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines.find((l) => l.id === input.journalLineIds[i])!;
      const amt = effectiveAmounts[i];
      if (line.debit > line.credit) {
        debitTotal += amt;
      } else {
        creditTotal += amt;
      }
    }

    if (debitTotal === 0 || creditTotal === 0) {
      throw new ValidationError(
        "Reconciliation requires at least one debit line and one credit line. " +
          "Provide lines from both sides of the AR/AP account (e.g. invoice + payment).",
        { debitTotal, creditTotal },
      );
    }

    // ── 6. Determine match type ───────────────────────────────────────────
    const difference = debitTotal - creditTotal;
    let matchType: "full" | "partial" | "overpayment";
    if (difference === 0) {
      matchType = "full";
    } else if (difference > 0) {
      matchType = "partial"; // payment < invoice
    } else {
      matchType = "overpayment"; // payment > invoice
    }

    // ── 7. Determine type (customer | supplier) ──────────────────────────
    const firstLine = lines[0];
    let reconcileType: "customer" | "supplier";
    if (firstLine.accountCode === "1100") {
      reconcileType = "customer";
    } else if (firstLine.accountCode === "2100") {
      reconcileType = "supplier";
    } else {
      // This should be unreachable if _validateHomogeneity() already restricts
      // reconciliation to AR/AP control accounts, but we fail fast here to keep
      // behavior and contracts consistent.
      throw new ValidationError(
        "Reconciliation is only supported for AR (1100) and AP (2100) control accounts.",
        { accountCode: firstLine.accountCode },
      );
    }

    // ── 8. Determine reconciliation status ────────────────────────────────
    const status =
      matchType === "full"
        ? "paid"
        : matchType === "partial"
          ? "partially_paid"
          : "paid"; // overpayment is also fully closed from the invoice perspective

    // ── 9. Persist reconciliation ─────────────────────────────────────────
    const reconciliation = await this.reconRepo.createReconciliation({
      type: reconcileType,
      status,
      notes: input.notes ?? null,
      createdBy: numUserId,
    });

    await this.reconRepo.createReconciliationLines(
      input.journalLineIds.map((lineId, idx) => ({
        reconciliationId: reconciliation.id!,
        journalEntryLineId: lineId,
        amount: effectiveAmounts[idx],
      })),
    );

    // ── 10. Mark lines reconciled ─────────────────────────────────────────
    // Only fully consumed lines (full match or explicitly fully applied) are
    // marked as reconciled.  Partially applied lines remain open.
    const fullyConsumedLineIds = input.journalLineIds.filter((id, idx) => {
      const line = lines.find((l) => l.id === id)!;
      return effectiveAmounts[idx] === Math.abs(line.balance);
    });

    if (fullyConsumedLineIds.length > 0) {
      await this.reconRepo.markLinesReconciled(
        fullyConsumedLineIds,
        reconciliation.id!,
      );
    }

    return {
      reconciliation,
      matchType,
      debitTotal,
      creditTotal,
      difference: Math.abs(difference),
    };
  }

  async executeSideEffectsPhase(
    result: CommitResult,
    userId: string,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logAction(
        Number(userId) || 0,
        "accounting:reconcile",
        "Reconciliation",
        result.reconciliation.id!,
        `Reconciliation #${result.reconciliation.id} created (${result.matchType})`,
        {
          reconciliationId: result.reconciliation.id,
          matchType: result.matchType,
          debitTotal: result.debitTotal,
          creditTotal: result.creditTotal,
        },
      );
    } catch (err) {
      console.warn("[ReconcileJournalLinesUseCase] Audit logging failed:", err);
    }
  }

  toEntity(result: CommitResult): ReconciliationResult {
    return result;
  }

  // ── Validation helpers ────────────────────────────────────────────────────

  private _validateHomogeneity(lines: ReconciliableJournalLine[]): void {
    const accounts = new Set(lines.map((l) => l.accountCode));
    if (accounts.size > 1) {
      throw new ValidationError(
        "All journal lines must belong to the same account for reconciliation. " +
          `Found accounts: ${[...accounts].join(", ")}`,
        { accounts: [...accounts] },
      );
    }

    const allowedAccounts = new Set(["1100", "2100"]);
    const accountCode = [...accounts][0];
    if (!allowedAccounts.has(accountCode ?? "")) {
      throw new ValidationError(
        `Reconciliation is only supported on AR (1100) and AP (2100) accounts. ` +
          `Provided account: ${accountCode}`,
        { accountCode },
      );
    }

    // Partner homogeneity: all lines must share the same partner
    const partners = new Set(lines.map((l) => l.partnerId));
    if (partners.size > 1) {
      throw new ValidationError(
        "All journal lines must belong to the same partner for reconciliation. " +
          `Found partners: ${[...partners].join(", ")}`,
        { partners: [...partners] },
      );
    }

    if (partners.has(null) || partners.has(undefined)) {
      throw new ValidationError(
        "Journal lines must have a partner_id set for AR/AP reconciliation. " +
          "Ensure invoices and payments are created with the correct customer or supplier ID.",
      );
    }
  }
}
