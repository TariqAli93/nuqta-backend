import { eq, and, inArray, sql, desc, isNull } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import {
  journalLines,
  journalEntries,
  accounts,
  reconciliations,
  reconciliationLines,
} from "../../schema/schema.js";
import type {
  IReconciliationRepository,
} from "../../../domain/interfaces/IReconciliationRepository.js";
import type {
  Reconciliation,
  ReconciliationLine,
  ReconciliableJournalLine,
  PartnerLedger,
  PartnerLedgerLine,
} from "../../../domain/entities/Reconciliation.js";

export class ReconciliationRepository implements IReconciliationRepository {
  constructor(private db: DbConnection) {}

  // ── Journal line queries ─────────────────────────────────────────────────

  async findJournalLinesByIds(
    ids: number[],
  ): Promise<ReconciliableJournalLine[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.execute(sql`
      SELECT
        jl.id,
        jl.journal_entry_id   AS "journalEntryId",
        jl.account_id         AS "accountId",
        a.code                AS "accountCode",
        jl.partner_id         AS "partnerId",
        jl.debit,
        jl.credit,
        jl.balance,
        jl.description,
        jl.reconciled,
        jl.reconciliation_id  AS "reconciliationId",
        jl.created_at         AS "createdAt",
        je.entry_number       AS "entryNumber",
        je.entry_date         AS "entryDate",
        je.source_type        AS "sourceType",
        je.source_id          AS "sourceId",
        GREATEST(0, ABS(jl.balance) - COALESCE(rl_sum.applied, 0)) AS "remainingBalance"
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      LEFT JOIN (
        SELECT journal_entry_line_id, SUM(amount) AS applied
        FROM reconciliation_lines
        GROUP BY journal_entry_line_id
      ) rl_sum ON rl_sum.journal_entry_line_id = jl.id
      WHERE jl.id = ANY(${ids}::int[])
        AND COALESCE(je.is_reversed, false) = false
    `);
    return this._mapLines(Array.isArray(rows) ? rows : []);
  }

  async findUnreconciledLinesByPartner(params: {
    partnerId: number;
    accountCode: string;
  }): Promise<ReconciliableJournalLine[]> {
    const rows = await this.db.execute(sql`
      SELECT
        jl.id,
        jl.journal_entry_id   AS "journalEntryId",
        jl.account_id         AS "accountId",
        a.code                AS "accountCode",
        jl.partner_id         AS "partnerId",
        jl.debit,
        jl.credit,
        jl.balance,
        jl.description,
        jl.reconciled,
        jl.reconciliation_id  AS "reconciliationId",
        jl.created_at         AS "createdAt",
        je.entry_number       AS "entryNumber",
        je.entry_date         AS "entryDate",
        je.source_type        AS "sourceType",
        je.source_id          AS "sourceId",
        GREATEST(0, ABS(jl.balance) - COALESCE(rl_sum.applied, 0)) AS "remainingBalance"
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      LEFT JOIN (
        SELECT journal_entry_line_id, SUM(amount) AS applied
        FROM reconciliation_lines
        GROUP BY journal_entry_line_id
      ) rl_sum ON rl_sum.journal_entry_line_id = jl.id
      WHERE jl.partner_id = ${params.partnerId}
        AND a.code = ${params.accountCode}
        AND jl.reconciled = false
        AND COALESCE(je.is_reversed, false) = false
      ORDER BY je.entry_date, jl.id
    `);
    return this._mapLines(Array.isArray(rows) ? rows : []);
  }

  async findUnreconciledLinesByAccount(params: {
    accountCode: string;
  }): Promise<ReconciliableJournalLine[]> {
    const rows = await this.db.execute(sql`
      SELECT
        jl.id,
        jl.journal_entry_id   AS "journalEntryId",
        jl.account_id         AS "accountId",
        a.code                AS "accountCode",
        jl.partner_id         AS "partnerId",
        jl.debit,
        jl.credit,
        jl.balance,
        jl.description,
        jl.reconciled,
        jl.reconciliation_id  AS "reconciliationId",
        jl.created_at         AS "createdAt",
        je.entry_number       AS "entryNumber",
        je.entry_date         AS "entryDate",
        je.source_type        AS "sourceType",
        je.source_id          AS "sourceId",
        GREATEST(0, ABS(jl.balance) - COALESCE(rl_sum.applied, 0)) AS "remainingBalance"
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      LEFT JOIN (
        SELECT journal_entry_line_id, SUM(amount) AS applied
        FROM reconciliation_lines
        GROUP BY journal_entry_line_id
      ) rl_sum ON rl_sum.journal_entry_line_id = jl.id
      WHERE a.code = ${params.accountCode}
        AND jl.reconciled = false
        AND COALESCE(je.is_reversed, false) = false
      ORDER BY je.entry_date, jl.id
    `);
    return this._mapLines(Array.isArray(rows) ? rows : []);
  }

  // ── Reconciliation CRUD ──────────────────────────────────────────────────

  async createReconciliation(
    data: Omit<Reconciliation, "id" | "createdAt" | "lines">,
  ): Promise<Reconciliation> {
    const [row] = await this.db
      .insert(reconciliations)
      .values({
        type: data.type,
        status: data.status ?? "open",
        notes: data.notes ?? null,
        createdBy: data.createdBy ?? null,
      })
      .returning();
    return this._mapReconciliation(row);
  }

  async createReconciliationLines(
    lines: Omit<ReconciliationLine, "id" | "createdAt" | "journalLine">[],
  ): Promise<ReconciliationLine[]> {
    if (lines.length === 0) return [];
    const rows = await this.db
      .insert(reconciliationLines)
      .values(
        lines.map((l) => ({
          reconciliationId: l.reconciliationId!,
          journalEntryLineId: l.journalEntryLineId,
          amount: l.amount,
        })),
      )
      .returning();
    return rows.map((r: any) => ({
      id: r.id as number,
      reconciliationId: r.reconciliationId as number,
      journalEntryLineId: r.journalEntryLineId as number,
      amount: r.amount as number,
      createdAt: r.createdAt as string,
    }));
  }

  async findReconciliationById(id: number): Promise<Reconciliation | null> {
    const [row] = await this.db
      .select()
      .from(reconciliations)
      .where(eq(reconciliations.id, id));
    if (!row) return null;
    const lines = await this._loadLines(id);
    return { ...this._mapReconciliation(row), lines };
  }

  async findReconciliations(params: {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Reconciliation[]; total: number }> {
    const conditions: any[] = [];
    if (params.type) conditions.push(eq(reconciliations.type, params.type));
    if (params.status) conditions.push(eq(reconciliations.status, params.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(reconciliations)
      .where(where);
    const total = Number(countRow?.count ?? 0);

    let query = this.db
      .select()
      .from(reconciliations)
      .where(where)
      .orderBy(desc(reconciliations.id))
      .$dynamic();
    if (params.limit) query = query.limit(params.limit);
    if (params.offset) query = query.offset(params.offset);

    const rows = await query;
    const items = await Promise.all(
      rows.map(async (row) => {
        const lines = await this._loadLines(row.id);
        return { ...this._mapReconciliation(row), lines };
      }),
    );
    return { items, total };
  }

  // ── Journal line state mutations ─────────────────────────────────────────

  async markLinesReconciled(
    lineIds: number[],
    reconciliationId: number,
  ): Promise<void> {
    if (lineIds.length === 0) return;
    await this.db
      .update(journalLines)
      .set({ reconciled: true, reconciliationId } as any)
      .where(inArray(journalLines.id, lineIds));
  }

  async markLinesUnreconciled(lineIds: number[]): Promise<void> {
    if (lineIds.length === 0) return;
    await this.db
      .update(journalLines)
      .set({ reconciled: false, reconciliationId: null } as any)
      .where(inArray(journalLines.id, lineIds));
  }

  async deleteReconciliationLines(reconciliationId: number): Promise<void> {
    await this.db
      .delete(reconciliationLines)
      .where(eq(reconciliationLines.reconciliationId, reconciliationId));
  }

  async deleteReconciliation(id: number): Promise<void> {
    await this.db
      .delete(reconciliations)
      .where(eq(reconciliations.id, id));
  }

  // ── Ledger (AR/AP) views ─────────────────────────────────────────────────

  async getCustomerLedger(customerId: number): Promise<PartnerLedger> {
    // AR account code = 1100
    return this._buildPartnerLedger(customerId, "1100", "customer");
  }

  async getSupplierLedger(supplierId: number): Promise<PartnerLedger> {
    // AP account code = 2100
    return this._buildPartnerLedger(supplierId, "2100", "supplier");
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async _buildPartnerLedger(
    partnerId: number,
    accountCode: string,
    _partnerType: "customer" | "supplier",
  ): Promise<PartnerLedger> {
    const rows = await this.db.execute(sql`
      SELECT
        jl.id                 AS "journalLineId",
        jl.journal_entry_id   AS "journalEntryId",
        je.entry_number       AS "entryNumber",
        je.entry_date         AS "entryDate",
        je.source_type        AS "sourceType",
        je.source_id          AS "sourceId",
        jl.description,
        jl.account_id         AS "accountId",
        a.code                AS "accountCode",
        a.name                AS "accountName",
        jl.debit,
        jl.credit,
        jl.balance,
        jl.reconciled,
        jl.reconciliation_id  AS "reconciliationId"
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      WHERE jl.partner_id = ${partnerId}
        AND a.code = ${accountCode}
        AND COALESCE(je.is_reversed, false) = false
      ORDER BY je.entry_date, jl.id
    `);

    const data: any[] = Array.isArray(rows) ? rows : [];

    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const lines: PartnerLedgerLine[] = data.map((r: any) => {
      const debit = Number(r.debit ?? 0);
      const credit = Number(r.credit ?? 0);
      runningBalance += debit - credit;
      totalDebit += debit;
      totalCredit += credit;

      return {
        journalLineId: Number(r.journalLineId),
        journalEntryId: Number(r.journalEntryId),
        entryNumber: String(r.entryNumber ?? ""),
        entryDate: String(r.entryDate ?? ""),
        sourceType: r.sourceType ?? null,
        sourceId: r.sourceId != null ? Number(r.sourceId) : null,
        description: r.description ?? null,
        accountId: Number(r.accountId),
        accountCode: String(r.accountCode ?? ""),
        accountName: String(r.accountName ?? ""),
        debit,
        credit,
        balance: debit - credit,
        reconciled: Boolean(r.reconciled),
        reconciliationId: r.reconciliationId != null ? Number(r.reconciliationId) : null,
        runningBalance,
      } satisfies PartnerLedgerLine;
    });

    // Partner name: try to resolve from customers or suppliers table at runtime.
    // We skip a JOIN here to keep the repository focused; caller can enrich.
    const partnerName = await this._resolvePartnerName(partnerId, _partnerType);

    return {
      partnerId,
      partnerName,
      lines,
      totalDebit,
      totalCredit,
      outstandingBalance: totalDebit - totalCredit,
    };
  }

  private async _resolvePartnerName(
    partnerId: number,
    type: "customer" | "supplier",
  ): Promise<string> {
    try {
      const table = type === "customer" ? "customers" : "suppliers";
      const rows = await this.db.execute(
        sql`SELECT name FROM ${sql.raw(table)} WHERE id = ${partnerId}`,
      );
      const data = Array.isArray(rows) ? rows : [];
      return (data[0] as any)?.name ?? String(partnerId);
    } catch {
      return String(partnerId);
    }
  }

  private async _loadLines(reconciliationId: number): Promise<ReconciliationLine[]> {
    const rows = await this.db
      .select()
      .from(reconciliationLines)
      .where(eq(reconciliationLines.reconciliationId, reconciliationId));
    return rows.map((r: any) => ({
      id: r.id as number,
      reconciliationId: r.reconciliationId as number,
      journalEntryLineId: r.journalEntryLineId as number,
      amount: r.amount as number,
      createdAt: r.createdAt as string,
    }));
  }

  private _mapReconciliation(row: any): Reconciliation {
    return {
      id: row.id as number,
      type: row.type as any,
      status: row.status as any,
      notes: row.notes ?? null,
      createdAt: row.createdAt as string,
      createdBy: row.createdBy ?? undefined,
    };
  }

  private _mapLines(rows: any[]): ReconciliableJournalLine[] {
    return rows.map((r: any) => ({
      id: Number(r.id),
      journalEntryId: Number(r.journalEntryId),
      accountId: Number(r.accountId),
      accountCode: String(r.accountCode ?? ""),
      partnerId: r.partnerId != null ? Number(r.partnerId) : null,
      debit: Number(r.debit ?? 0),
      credit: Number(r.credit ?? 0),
      balance: Number(r.balance ?? 0),
      description: r.description ?? null,
      reconciled: Boolean(r.reconciled),
      reconciliationId: r.reconciliationId != null ? Number(r.reconciliationId) : null,
      createdAt: r.createdAt as string,
      entryNumber: r.entryNumber ? String(r.entryNumber) : undefined,
      entryDate: r.entryDate ? String(r.entryDate) : undefined,
      sourceType: r.sourceType ?? null,
      sourceId: r.sourceId != null ? Number(r.sourceId) : null,
      remainingBalance: r.remainingBalance != null
        ? Number(r.remainingBalance)
        : Math.abs(Number(r.balance ?? 0)),
    }));
  }
}
