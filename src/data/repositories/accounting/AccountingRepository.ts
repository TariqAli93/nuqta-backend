import { randomUUID } from "node:crypto";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import type { TxOrDb } from "../../db/transaction.js";
import {
  accounts,
  journalEntries,
  journalLines,
  postingBatches,
} from "../../schema/schema.js";
import {
  IAccountingRepository,
  Account,
  JournalEntry,
  JournalLine,
  CreateJournalEntryInput,
} from "../../../domain/index.js";
import type {
  ReversalEntryParams,
  CreditNoteEntryParams,
  PaymentReversalEntryParams,
} from "../../../domain/interfaces/IAccountingRepository.js";
import { InvalidStateError } from "../../../domain/shared/errors/DomainErrors.js";

export class AccountingRepository implements IAccountingRepository {
  constructor(private db: DbConnection) {}

  private c(tx?: TxOrDb): TxOrDb {
    return tx ?? this.db;
  }

  private async insertJournalEntry(
    entry: CreateJournalEntryInput,
    tx?: TxOrDb,
  ): Promise<JournalEntry> {
    const needsAutoNumber = !entry.entryNumber;

    const perform = async (client: TxOrDb): Promise<JournalEntry> => {
      const { lines, ...entryData } = entry;

      // When no entryNumber is provided, use a unique placeholder for the
      // NOT NULL + UNIQUE insert, then replace it with an ID-based number.
      const insertData = needsAutoNumber
        ? { ...entryData, entryNumber: `_pending_${randomUUID()}` }
        : entryData;

      const [created] = await client
        .insert(journalEntries)
        .values(insertData as any)
        .returning();

      if (needsAutoNumber) {
        const prefix = entryData.sourceType?.toUpperCase() ?? "MAN";
        await client
          .update(journalEntries)
          .set({ entryNumber: `JE-${prefix}-${created.id}` })
          .where(eq(journalEntries.id, created.id));
      }

      if (lines && lines.length > 0) {
        const lineValues = lines.map((line) => {
          return {
            journalEntryId: created.id,
            accountId: line.accountId,
            partnerId: line.partnerId ?? null,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            description: line.description ?? null,
            reconciled: false,
            reconciliationId: null,
          };
        });
        await client.insert(journalLines).values(lineValues as any);
      }

      return this.getEntryById(created.id, client) as Promise<JournalEntry>;
    };

    // Auto-generated entry numbers require insert + update; wrap in a
    // transaction for atomicity when the caller didn't provide one.
    if (needsAutoNumber && !tx) {
      return this.db.transaction(perform);
    }
    return perform(this.c(tx));
  }

  async createJournalEntry(
    entry: CreateJournalEntryInput,
    tx?: TxOrDb,
  ): Promise<JournalEntry> {
    return this.insertJournalEntry(entry, tx);
  }

  async createJournalEntrySync(
    entry: CreateJournalEntryInput,
    tx?: TxOrDb,
  ): Promise<JournalEntry> {
    return this.insertJournalEntry(entry, tx);
  }

  async createAccountSync(
    account: Omit<Account, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<Account> {
    const { balance: _ignoredBalance, ...insertable } = account;
    const [created] = await this.c(tx)
      .insert(accounts)
      .values(insertable as any)
      .returning();
    return { ...(created as unknown as Account), balance: 0 };
  }

  async findAccountByCode(code: string, tx?: TxOrDb): Promise<Account | null> {
    const rows = await this.c(tx)
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        nameAr: accounts.nameAr,
        accountType: accounts.accountType,
        parentId: accounts.parentId,
        isSystem: accounts.isSystem,
        isActive: accounts.isActive,
        createdAt: accounts.createdAt,
        balance: sql<number>`COALESCE(SUM(${journalLines.balance}), 0)`,
      })
      .from(accounts)
      .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
      .where(eq(accounts.code, code))
      .groupBy(accounts.id);
    const row = rows[0];
    return (row as unknown as Account) || null;
  }

  async findAccountById(id: number, tx?: TxOrDb): Promise<Account | null> {
    const rows = await this.c(tx)
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        nameAr: accounts.nameAr,
        accountType: accounts.accountType,
        parentId: accounts.parentId,
        isSystem: accounts.isSystem,
        isActive: accounts.isActive,
        createdAt: accounts.createdAt,
        balance: sql<number>`COALESCE(SUM(${journalLines.balance}), 0)`,
      })
      .from(accounts)
      .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
      .where(eq(accounts.id, id))
      .groupBy(accounts.id);
    const row = rows[0];
    return (row as unknown as Account) || null;
  }

  async getAccounts(tx?: TxOrDb): Promise<Account[]> {
    const rows = await this.c(tx)
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        nameAr: accounts.nameAr,
        accountType: accounts.accountType,
        parentId: accounts.parentId,
        isSystem: accounts.isSystem,
        isActive: accounts.isActive,
        createdAt: accounts.createdAt,
        balance: sql<number>`COALESCE(SUM(${journalLines.balance}), 0)`,
      })
      .from(accounts)
      .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
      .groupBy(accounts.id)
      .orderBy(accounts.code);
    return rows as unknown as Account[];
  }

  async getJournalEntries(params?: {
    sourceType?: string;
    dateFrom?: string;
    dateTo?: string;
    isPosted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: JournalEntry[]; total: number }> {
    const conditions: any[] = [];
    if (params?.sourceType)
      conditions.push(eq(journalEntries.sourceType, params.sourceType as any));
    if (params?.dateFrom)
      conditions.push(
        gte(journalEntries.entryDate, new Date(params.dateFrom).toISOString()),
      );
    if (params?.dateTo)
      conditions.push(
        lte(journalEntries.entryDate, new Date(params.dateTo).toISOString()),
      );
    if (params?.isPosted !== undefined)
      conditions.push(eq(journalEntries.isPosted, params.isPosted));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db
      .select()
      .from(journalEntries)
      .where(where)
      .orderBy(desc(journalEntries.id))
      .$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const rows = await query;
    const items = await Promise.all(
      rows.map(async (row) => {
        const lines = await this.db
          .select()
          .from(journalLines)
          .where(eq(journalLines.journalEntryId, row.id));
        return { ...row, lines } as unknown as JournalEntry;
      }),
    );
    return { items, total };
  }

  async getEntryById(id: number, tx?: TxOrDb): Promise<JournalEntry | null> {
    const client = this.c(tx);
    const [row] = await client
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, id));
    if (!row) return null;

    const lines = await client
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, id));

    return { ...row, lines } as unknown as JournalEntry;
  }

  async findEntryBySource(
    sourceType: string,
    sourceId: number,
    tx?: TxOrDb,
  ): Promise<JournalEntry | null> {
    const client = this.c(tx);
    const [row] = await client
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.sourceType, sourceType as any),
          eq(journalEntries.sourceId, sourceId),
        ),
      )
      .orderBy(desc(journalEntries.id))
      .limit(1);
    if (!row) return null;
    return this.getEntryById(row.id, tx);
  }

  /**
   * Block-level guard: reject the operation when the given calendar date
   * (YYYY-MM-DD or ISO string) falls inside any locked posting batch.
   *
   * This is the lowest-level, backend-authoritative check.  All entry-creation
   * paths (reversal, credit-note, payment-reversal, manual) must call this so
   * that business flows cannot silently bypass period locks.
   */
  private async assertDateNotInLockedBatch(
    dateInput: string | Date,
    client: TxOrDb,
  ): Promise<void> {
    const dateStr =
      dateInput instanceof Date
        ? dateInput.toISOString().slice(0, 10)
        : String(dateInput).slice(0, 10);

    const [locked] = await client
      .select({
        id: postingBatches.id,
        periodStart: postingBatches.periodStart,
        periodEnd: postingBatches.periodEnd,
      })
      .from(postingBatches)
      .where(
        and(
          eq(postingBatches.status, "locked"),
          lte(postingBatches.periodStart, dateStr),
          gte(postingBatches.periodEnd, dateStr),
        ),
      )
      .limit(1);

    if (locked) {
      throw new InvalidStateError(
        `لا يمكن تسجيل قيد محاسبي في فترة مقفلة (${locked.periodStart} — ${locked.periodEnd}). أعد فتح الدفعة أولاً أو استخدم تاريخاً في فترة مفتوحة.`,
      );
    }
  }

  /**
   * Guard: reject reversal when the original entry belongs to a locked
   * posting batch.  This prevents business flows (cancel-sale, etc.) from
   * mutating entries in closed accounting periods by marking them isReversed.
   */
  private async assertEntryNotInLockedBatch(
    originalEntry: JournalEntry,
    client: TxOrDb,
  ): Promise<void> {
    if (!originalEntry.postingBatchId) return; // not assigned to any batch → safe

    const [batch] = await client
      .select({ status: postingBatches.status, id: postingBatches.id })
      .from(postingBatches)
      .where(eq(postingBatches.id, originalEntry.postingBatchId))
      .limit(1);

    if (batch?.status === "locked") {
      throw new InvalidStateError(
        `لا يمكن عكس قيد محاسبي موجود في دفعة ترحيل مقفلة (دفعة رقم ${batch.id}). أعد فتح الدفعة أولاً أو أنشئ قيد تسوية يدوي في فترة مفتوحة.`,
      );
    }
  }

  async createReversalEntry(
    params: ReversalEntryParams,
    tx?: TxOrDb,
  ): Promise<JournalEntry> {
    const client = this.c(tx);

    // Load original entry with its lines
    const original = await this.getEntryById(params.originalEntryId, tx);
    if (!original) {
      throw new Error(
        `Journal entry ${params.originalEntryId} not found for reversal`,
      );
    }

    // ── POSTING-LOCK GUARD ──────────────────────────────────────────────────
    // Block reversal if the original entry is assigned to a locked batch.
    // This is the backend-authoritative check that all callers go through,
    // including business flows (CancelSaleUseCase) that bypass ReverseEntryUseCase.
    await this.assertEntryNotInLockedBatch(original, client);

    // Also block if the reversal's own target date falls in a locked period.
    await this.assertDateNotInLockedBatch(params.reversalDate, client);

    // Mirror lines (swap debit/credit)
    const reversedLines = (original.lines ?? []).map((line: JournalLine) => ({
      accountId: line.accountId,
      partnerId: line.partnerId ?? null,
      debit: line.credit ?? 0,
      credit: line.debit ?? 0,
      description: line.description ?? null,
    }));

    // Compute total amount for the reversal entry
    const reversalTotalAmount = reversedLines.reduce(
      (sum, line) => sum + (line.debit ?? 0) + (line.credit ?? 0),
      0,
    );

    const reversalEntry: JournalEntry = {
      // derive required fields from the original entry
      entryNumber: `${original.entryNumber}-REV`,
      currency: original.currency,
      totalAmount: reversalTotalAmount,
      description: params.description,
      entryDate: params.reversalDate.toISOString(),
      sourceType: params.sourceType as any,
      sourceId: params.sourceId,
      isPosted: params.isPosted ?? true,
      isReversed: false,
      reversalOfId: params.originalEntryId,
      createdBy: params.createdBy,
      lines: reversedLines as JournalLine[],
    } as JournalEntry;

    const created = await this.insertJournalEntry(reversalEntry, tx);

    // Mark original as reversed
    await client
      .update(journalEntries)
      .set({ isReversed: true } as any)
      .where(eq(journalEntries.id, params.originalEntryId));

    return created;
  }

  async createCreditNoteEntry(
    params: CreditNoteEntryParams,
    tx?: TxOrDb,
  ): Promise<JournalEntry> {
    const client = this.c(tx);

    // ── POSTING-LOCK GUARD ──────────────────────────────────────────────────
    // Credit notes are posted with entryDate = today.  Block if today falls
    // inside a locked posting batch period.
    await this.assertDateNotInLockedBatch(new Date(), client);

    const netRevenue = params.netRevenue ?? params.amount;
    const vatAmount = params.vatAmount ?? 0;
    const cogsReversal = params.cogsReversal ?? 0;

    // Resolve account IDs — fall back to looking up by standard codes
    const [revenueAcc, cashAcc, vatAcc, cogsAcc, inventoryAcc, arAcc] =
      await Promise.all([
        params.revenueAccountId
          ? Promise.resolve({ id: params.revenueAccountId })
          : this.findAccountByCode("4001", tx),
        params.cashAccountId
          ? Promise.resolve({ id: params.cashAccountId })
          : this.findAccountByCode("1001", tx),
        params.vatOutputAccountId
          ? Promise.resolve({ id: params.vatOutputAccountId })
          : this.findAccountByCode("2200", tx),
        params.cogsAccountId
          ? Promise.resolve({ id: params.cogsAccountId })
          : this.findAccountByCode("5001", tx),
        params.inventoryAccountId
          ? Promise.resolve({ id: params.inventoryAccountId })
          : this.findAccountByCode("1200", tx),
        params.arAccountId
          ? Promise.resolve({ id: params.arAccountId })
          : this.findAccountByCode("1100", tx),
      ]);

    const lines: Partial<JournalLine>[] = [];

    // DR Revenue (reverse the sale revenue)
    if (revenueAcc?.id) {
      lines.push({
        accountId: revenueAcc.id,
        debit: netRevenue,
        credit: 0,
        description: "Credit note — revenue reversal",
      });
    }

    // DR VAT Output (if VAT was charged)
    if (vatAmount > 0 && vatAcc?.id) {
      lines.push({
        accountId: vatAcc.id,
        debit: vatAmount,
        credit: 0,
        description: "Credit note — VAT reversal",
      });
    }

    // CR Cash / AR
    // Respect what the caller explicitly passed:
    //   - cashAccountId passed (and arAccountId not) → cash refund (cash sale)
    //   - arAccountId passed (and cashAccountId not) → AR reduction (credit sale)
    //   - neither passed → legacy fallback: prefer cash then AR
    let cashOrArId: number | undefined;
    if (params.cashAccountId != null) {
      cashOrArId = cashAcc?.id;
    } else if (params.arAccountId != null) {
      cashOrArId = arAcc?.id;
    } else {
      cashOrArId = cashAcc?.id ?? arAcc?.id;
    }
    if (cashOrArId) {
      lines.push({
        accountId: cashOrArId,
        // Stamp the partner so the refund credit appears in the customer's AR
        // ledger.  Without partnerId the line is invisible to _buildPartnerLedger
        // (which filters jl.partner_id = customerId), causing the outstanding AR
        // balance to look inflated after a credit-sale refund.
        partnerId: params.partnerId ?? null,
        debit: 0,
        credit: params.amount,
        description: "Credit note — cash/AR refund",
      });
    }

    // COGS reversal (if goods returned): CR COGS, DR Inventory
    if (cogsReversal > 0) {
      if (cogsAcc?.id) {
        lines.push({
          accountId: cogsAcc.id,
          debit: 0,
          credit: cogsReversal,
          description: "Credit note — COGS reversal",
        });
      }
      if (inventoryAcc?.id) {
        lines.push({
          accountId: inventoryAcc.id,
          debit: cogsReversal,
          credit: 0,
          description: "Credit note — inventory restored",
        });
      }
    }

    // Safety: verify the entry is balanced before inserting.
    // An unbalanced entry here means a required account ID was missing or
    // the caller computed netRevenue + vatAmount ≠ amount — both are bugs.
    const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (totalDebit !== totalCredit) {
      throw new Error(
        `[AccountingRepository] Credit note journal is unbalanced for sale ${params.saleId}: DR=${totalDebit} CR=${totalCredit}`,
      );
    }

    const entryNumber = `JE-CN-${params.saleId}-${Date.now()}`;
    const entry: JournalEntry = {
      entryNumber,
      description: params.description,
      entryDate: new Date().toISOString(),
      sourceType: "sale_refund" as any,
      sourceId: params.saleId,
      totalAmount: params.amount,
      currency: params.currency,
      isPosted: true,
      isReversed: false,
      createdBy: params.createdBy,
      lines: lines as JournalLine[],
    } as JournalEntry;

    return this.insertJournalEntry(entry, tx);
  }

  async createPaymentReversalEntry(
    params: PaymentReversalEntryParams,
    tx?: TxOrDb,
  ): Promise<JournalEntry> {
    const client = this.c(tx);

    // ── POSTING-LOCK GUARD ──────────────────────────────────────────────────
    // Payment reversals are posted with entryDate = today.  Block if today
    // falls inside a locked posting batch period.
    await this.assertDateNotInLockedBatch(new Date(), client);

    const [cashAcc, arAcc] = await Promise.all([
      params.cashAccountId
        ? Promise.resolve({ id: params.cashAccountId })
        : this.findAccountByCode("1001", tx),
      params.arAccountId
        ? Promise.resolve({ id: params.arAccountId })
        : this.findAccountByCode("1100", tx),
    ]);

    const lines: Partial<JournalLine>[] = [];

    // DR AR (reverse the AR reduction that happened at payment time)
    if (arAcc?.id) {
      lines.push({
        accountId: arAcc.id,
        debit: params.amount,
        credit: 0,
        description: "Payment reversal — AR restored",
      });
    }

    // CR Cash (cash goes back out)
    if (cashAcc?.id) {
      lines.push({
        accountId: cashAcc.id,
        debit: 0,
        credit: params.amount,
        description: "Payment reversal — cash refunded",
      });
    }

    const entry: JournalEntry = {
      entryNumber:
        params.entryNumber || `JE-PREV-${params.saleId}-${Date.now()}`,
      totalAmount: params.amount,
      currency: params.currency || "IQD",
      description: params.description,
      entryDate: new Date().toISOString(),
      sourceType: "sale_cancellation" as any,
      sourceId: params.saleId,
      isPosted: params.isPosted ?? true,
      isReversed: false,
      createdBy: params.createdBy,
      lines: lines as JournalLine[],
    } as JournalEntry;

    return this.insertJournalEntry(entry, tx);
  }

  async getTrialBalance(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<
    {
      accountId: number;
      accountCode: string;
      accountName: string;
      accountType: string;
      debitTotal: number;
      creditTotal: number;
      balance: number;
    }[]
  > {
    const dateFrom = params?.dateFrom ?? null;
    const dateTo = params?.dateTo ?? null;

    const result = await this.db.execute(sql`
      SELECT
        a.id AS "accountId",
        a.code AS "accountCode",
        a.name AS "accountName",
        a.account_type AS "accountType",
        COALESCE(SUM(jl.debit), 0) AS "debitTotal",
        COALESCE(SUM(jl.credit), 0) AS "creditTotal",
        COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS "balance"
      FROM accounts a
      INNER JOIN journal_lines jl ON jl.account_id = a.id
      INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE je.is_posted = true
        AND COALESCE(je.is_reversed, false) = false
        AND (${dateFrom}::text IS NULL OR je.entry_date >= ${dateFrom})
        AND (${dateTo}::text IS NULL OR je.entry_date <= ${dateTo})
      GROUP BY a.id, a.code, a.name, a.account_type
      ORDER BY a.code
    `);

    const data = result.rows ?? [];

    return data.map((r: any) => ({
      accountId: Number(r.accountId),
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountType: r.accountType,
      debitTotal: Number(r.debitTotal),
      creditTotal: Number(r.creditTotal),
      balance: Number(r.balance),
    }));
  }

  async getProfitLoss(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    revenue: { accountId: number; name: string; amount: number }[];
    expenses: { accountId: number; name: string; amount: number }[];
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
  }> {
    const dateFrom = params?.dateFrom ?? null;
    const dateTo = params?.dateTo ?? null;

    const result = await this.db.execute(sql`
      SELECT
        a.id AS "accountId",
        a.name,
        a.account_type AS "accountType",
        COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) AS "netAmount"
      FROM accounts a
      JOIN journal_lines jl ON jl.account_id = a.id
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE je.is_posted = true
        AND COALESCE(je.is_reversed, false) = false
        AND (${dateFrom}::text IS NULL OR je.entry_date >= ${dateFrom})
        AND (${dateTo}::text IS NULL OR je.entry_date <= ${dateTo})
        AND a.account_type IN ('revenue', 'expense')
      GROUP BY a.id, a.name, a.account_type
      ORDER BY a.account_type, a.name
    `);

    const revenue: { accountId: number; name: string; amount: number }[] = [];
    const expenses: { accountId: number; name: string; amount: number }[] = [];
    let totalRevenue = 0;
    let totalExpenses = 0;

    const data = result.rows ?? [];
    for (const row of data as any[]) {
      if (row.accountType === "revenue") {
        const amount = Number(row.netAmount);
        revenue.push({ accountId: row.accountId, name: row.name, amount });
        totalRevenue += amount;
      } else {
        // For expenses, net is usually debit > credit, so negate
        const amount = -Number(row.netAmount);
        expenses.push({
          accountId: row.accountId,
          name: row.name,
          amount,
        });
        totalExpenses += amount;
      }
    }

    console.log("Profit & Loss Data:", {
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
    });

    return {
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
    };
  }

  async getBalanceSheet(params?: {
    dateFrom?: string;
    dateTo?: string;
    /** @deprecated use dateFrom */ fromDate?: string;
    /** @deprecated use dateTo */ toDate?: string;
  }): Promise<{
    assets: { accountId: number; name: string; balance: number }[];
    liabilities: { accountId: number; name: string; balance: number }[];
    equity: { accountId: number; name: string; balance: number }[];
    totalAssets: number;
    totalLiabilities: number;
    equityAccounts: number;
    revenueNet: number;
    expenseNet: number;
    currentEarnings: number;
    totalEquity: number;
    difference: number;
  }> {
    const fromDate = params?.dateFrom ?? params?.fromDate ?? null;
    const toDate = params?.dateTo ?? params?.toDate ?? null;

    const result = await this.db.execute(sql`
      SELECT
        a.id AS "accountId",
        a.name,
        a.code,
        a.account_type AS "accountType",
        COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS "balance"
      FROM accounts a
      LEFT JOIN (
        SELECT jl2.account_id, jl2.debit, jl2.credit
        FROM journal_lines jl2
        INNER JOIN journal_entries je ON je.id = jl2.journal_entry_id
        WHERE je.is_posted = true
          AND COALESCE(je.is_reversed, false) = false
          AND (${fromDate}::text IS NULL OR je.entry_date >= ${fromDate})
          AND (${toDate}::text IS NULL OR je.entry_date <= ${toDate})
      ) jl ON jl.account_id = a.id
      WHERE a.is_active = true
      GROUP BY a.id, a.name, a.code, a.account_type
      ORDER BY a.account_type, a.code
    `);

    const assets: { accountId: number; name: string; balance: number }[] = [];
    const liabilities: { accountId: number; name: string; balance: number }[] =
      [];
    const equity: { accountId: number; name: string; balance: number }[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let equityAccounts = 0;
    let revenueNet = 0;
    let expenseNet = 0;

    const data = result.rows ?? [];
    for (const row of data as any[]) {
      const balance = Number(row.balance);
      switch (row.accountType) {
        case "asset":
          assets.push({
            accountId: row.accountId,
            name: row.name,
            balance,
          });
          totalAssets += balance;
          break;
        case "liability":
          liabilities.push({
            accountId: row.accountId,
            name: row.name,
            balance: -balance,
          });
          totalLiabilities += -balance;
          break;
        case "equity":
          equity.push({
            accountId: row.accountId,
            name: row.name,
            balance: -balance,
          });
          equityAccounts += -balance;
          break;
        case "revenue":
          revenueNet += -balance;
          break;
        case "expense":
          expenseNet += balance;
          break;
      }
    }

    const currentEarnings = revenueNet - expenseNet;
    const totalEquity = equityAccounts + currentEarnings;
    const difference = totalAssets - totalLiabilities - totalEquity;

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      equityAccounts,
      revenueNet,
      expenseNet,
      currentEarnings,
      totalEquity,
      difference,
    };
  }
}
