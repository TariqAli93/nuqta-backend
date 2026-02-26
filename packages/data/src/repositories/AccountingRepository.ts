import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { accounts, journalEntries, journalLines } from "../schema/schema.js";
import {
  IAccountingRepository,
  Account,
  JournalEntry,
  JournalLine,
} from "@nuqta/core";

export class AccountingRepository implements IAccountingRepository {
  constructor(private db: DbConnection) {}

  async createJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
    const { lines, ...entryData } = entry;

    const [created] = await this.db
      .insert(journalEntries)
      .values(entryData as any)
      .returning();

    if (lines && lines.length > 0) {
      const lineValues = lines.map((line) => ({
        ...line,
        journalEntryId: created.id,
      }));
      await this.db.insert(journalLines).values(lineValues as any);

      // Update account balances
      for (const line of lines) {
        const netAmount = (line.debit || 0) - (line.credit || 0);
        await this.db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${netAmount}`,
          } as any)
          .where(eq(accounts.id, line.accountId));
      }
    }

    return this.getEntryById(created.id) as Promise<JournalEntry>;
  }

  async createJournalEntrySync(entry: JournalEntry): Promise<JournalEntry> {
    return this.createJournalEntry(entry);
  }

  async createAccountSync(
    account: Omit<Account, "id" | "createdAt">,
  ): Promise<Account> {
    const [created] = await this.db
      .insert(accounts)
      .values(account as any)
      .returning();
    return created as unknown as Account;
  }

  async findAccountByCode(code: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.code, code));
    return (row as unknown as Account) || null;
  }

  async getAccounts(): Promise<Account[]> {
    const rows = await this.db.select().from(accounts).orderBy(accounts.code);
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
      conditions.push(eq(journalEntries.sourceType, params.sourceType));
    if (params?.dateFrom)
      conditions.push(gte(journalEntries.entryDate, new Date(params.dateFrom)));
    if (params?.dateTo)
      conditions.push(lte(journalEntries.entryDate, new Date(params.dateTo)));
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

  async getEntryById(id: number): Promise<JournalEntry | null> {
    const [row] = await this.db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, id));
    if (!row) return null;

    const lines = await this.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, id));

    return { ...row, lines } as unknown as JournalEntry;
  }

  async getTrialBalance(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ accountId: number; creditTotal: number; balance: number }[]> {
    const conditions: string[] = [
      "je.is_posted = true",
      "COALESCE(je.is_reversed, false) = false",
    ];
    if (params?.dateFrom)
      conditions.push(`je.entry_date >= '${params.dateFrom}'`);
    if (params?.dateTo) conditions.push(`je.entry_date <= '${params.dateTo}'`);

    const whereClause = conditions.join(" AND ");

    const rows = await this.db.execute(
      sql.raw(`
      SELECT
        jl.account_id AS "accountId",
        COALESCE(SUM(jl.debit), 0) AS "debitTotal",
        COALESCE(SUM(jl.credit), 0) AS "creditTotal",
        COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS "balance"
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE ${whereClause}
      GROUP BY jl.account_id
      ORDER BY jl.account_id
    `),
    );

    return (rows as any[]).map((r: any) => ({
      accountId: r.accountId,
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
    const conditions: string[] = [
      "je.is_posted = true",
      "COALESCE(je.is_reversed, false) = false",
    ];
    if (params?.dateFrom)
      conditions.push(`je.entry_date >= '${params.dateFrom}'`);
    if (params?.dateTo) conditions.push(`je.entry_date <= '${params.dateTo}'`);

    const whereClause = conditions.join(" AND ");

    const rows = await this.db.execute(
      sql.raw(`
      SELECT
        a.id AS "accountId",
        a.name,
        a.account_type AS "accountType",
        COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) AS "netAmount"
      FROM accounts a
      JOIN journal_lines jl ON jl.account_id = a.id
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE ${whereClause}
        AND a.account_type IN ('revenue', 'expense')
      GROUP BY a.id, a.name, a.account_type
      ORDER BY a.account_type, a.name
    `),
    );

    const revenue: { accountId: number; name: string; amount: number }[] = [];
    const expenses: { accountId: number; name: string; amount: number }[] = [];
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const row of rows as any[]) {
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

    return {
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
    };
  }

  async getBalanceSheet(params?: {
    fromDate?: string;
    toDate?: string;
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
    const conditions: string[] = [
      "je.is_posted = true",
      "COALESCE(je.is_reversed, false) = false",
    ];
    if (params?.toDate) conditions.push(`je.entry_date <= '${params.toDate}'`);
    if (params?.fromDate)
      conditions.push(`je.entry_date >= '${params.fromDate}'`);

    const whereClause = conditions.join(" AND ");

    const rows = await this.db.execute(
      sql.raw(`
      SELECT
        a.id AS "accountId",
        a.name,
        a.account_type AS "accountType",
        COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS "balance"
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND ${whereClause}
      WHERE a.is_active = true
      GROUP BY a.id, a.name, a.account_type
      ORDER BY a.account_type, a.code
    `),
    );

    const assets: { accountId: number; name: string; balance: number }[] = [];
    const liabilities: { accountId: number; name: string; balance: number }[] =
      [];
    const equity: { accountId: number; name: string; balance: number }[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let equityAccounts = 0;
    let revenueNet = 0;
    let expenseNet = 0;

    for (const row of rows as any[]) {
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
