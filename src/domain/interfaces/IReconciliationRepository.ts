import type {
  Reconciliation,
  ReconciliationLine,
  ReconciliableJournalLine,
  PartnerLedger,
} from "../entities/Reconciliation.js";

export interface IReconciliationRepository {
  // ── Journal line queries ──────────────────────────────────────

  /**
   * Fetch journal lines by IDs, enriched with journal entry meta.
   */
  findJournalLinesByIds(ids: number[]): Promise<ReconciliableJournalLine[]>;

  /**
   * Find all unreconciled AR/AP journal lines for a specific partner
   * on a given account (AR or AP account code).
   */
  findUnreconciledLinesByPartner(params: {
    partnerId: number;
    accountCode: string;
  }): Promise<ReconciliableJournalLine[]>;

  /**
   * Find all unreconciled lines on a given account (account-level reconciliation).
   */
  findUnreconciledLinesByAccount(params: {
    accountCode: string;
  }): Promise<ReconciliableJournalLine[]>;

  // ── Reconciliation CRUD ───────────────────────────────────────

  createReconciliation(
    data: Omit<Reconciliation, "id" | "createdAt" | "lines">,
  ): Promise<Reconciliation>;

  createReconciliationLines(
    lines: Omit<ReconciliationLine, "id" | "createdAt" | "journalLine">[],
  ): Promise<ReconciliationLine[]>;

  findReconciliationById(id: number): Promise<Reconciliation | null>;

  findReconciliations(params: {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Reconciliation[]; total: number }>;

  // ── Journal line state mutations ──────────────────────────────

  markLinesReconciled(
    lineIds: number[],
    reconciliationId: number,
  ): Promise<void>;

  markLinesUnreconciled(lineIds: number[]): Promise<void>;

  deleteReconciliationLines(reconciliationId: number): Promise<void>;

  deleteReconciliation(id: number): Promise<void>;

  // ── Ledger (AR/AP) views ──────────────────────────────────────

  getCustomerLedger(customerId: number): Promise<PartnerLedger>;

  getSupplierLedger(supplierId: number): Promise<PartnerLedger>;
}
