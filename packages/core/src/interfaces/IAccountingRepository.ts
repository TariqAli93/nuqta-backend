import { Account, JournalEntry } from "../entities/Accounting.js";

export interface IAccountingRepository {
  createJournalEntry(entry: JournalEntry): Promise<JournalEntry>;
  createJournalEntrySync(entry: JournalEntry): Promise<JournalEntry>;
  createAccountSync(
    account: Omit<Account, "id" | "createdAt">,
  ): Promise<Account>;
  findAccountByCode(code: string): Promise<Account | null>;
  getAccounts(): Promise<Account[]>;
  getJournalEntries(params?: {
    sourceType?: string;
    dateFrom?: string;
    dateTo?: string;
    isPosted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: JournalEntry[]; total: number }>;
  getEntryById(id: number): Promise<JournalEntry | null>;
  getTrialBalance(params?: { dateFrom?: string; dateTo?: string }): Promise<
    {
      accountId: number;
      creditTotal: number;
      balance: number;
    }[]
  >;
  getProfitLoss(params?: { dateFrom?: string; dateTo?: string }): Promise<{
    revenue: { accountId: number; name: string; amount: number }[];
    expenses: { accountId: number; name: string; amount: number }[];
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
  }>;
  getBalanceSheet(params?: { fromDate?: string; toDate?: string }): Promise<{
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
  }>;
}
