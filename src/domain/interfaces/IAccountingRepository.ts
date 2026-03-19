import { Account, JournalEntry } from "../entities/Accounting.js";
import type { TxOrDb } from "../../data/db/transaction.js";

export interface ReversalEntryParams {
  originalEntryId: number;
  reversalDate: Date;
  description: string;
  sourceType: string;
  sourceId: number;
  createdBy: number;
}

export interface CreditNoteEntryParams {
  saleId: number;
  amount: number;
  description: string;
  createdBy: number;
  currency?: string;
  /** Pre-tax revenue amount to reverse (defaults to amount if not supplied) */
  netRevenue?: number;
  /** VAT amount to reverse (0 if none) */
  vatAmount?: number;
  /** COGS to restore on inventory (0 if no goods returned) */
  cogsReversal?: number;
  cashAccountId?: number;
  revenueAccountId?: number;
  vatOutputAccountId?: number;
  cogsAccountId?: number;
  inventoryAccountId?: number;
  arAccountId?: number;
}

export interface PaymentReversalEntryParams {
  saleId: number;
  amount: number;
  description: string;
  createdBy: number;
  entryNumber?: string;
  currency?: string;
  cashAccountId?: number;
  arAccountId?: number;
}

export interface IAccountingRepository {
  createJournalEntry(entry: JournalEntry, tx?: TxOrDb): Promise<JournalEntry>;
  createJournalEntrySync(
    entry: JournalEntry,
    tx?: TxOrDb,
  ): Promise<JournalEntry>;
  createAccountSync(
    account: Omit<Account, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<Account>;
  findAccountByCode(code: string, tx?: TxOrDb): Promise<Account | null>;
  getAccounts(tx?: TxOrDb): Promise<Account[]>;
  getJournalEntries(params?: {
    sourceType?: string;
    dateFrom?: string;
    dateTo?: string;
    isPosted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: JournalEntry[]; total: number }>;
  getEntryById(id: number, tx?: TxOrDb): Promise<JournalEntry | null>;
  getTrialBalance(params?: { dateFrom?: string; dateTo?: string }): Promise<
    {
      accountId: number;
      accountCode: string;
      accountName: string;
      accountType: string;
      debitTotal: number;
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

  /** Find the most recent journal entry tied to a source (e.g. sourceType="sale", sourceId=42). */
  findEntryBySource(
    sourceType: string,
    sourceId: number,
    tx?: TxOrDb,
  ): Promise<JournalEntry | null>;

  /**
   * Create a reversal (mirror) of an existing journal entry.
   * Each debit becomes a credit and vice-versa.
   * Sets isReversed=true on the original and reversalOfId on the new entry.
   */
  createReversalEntry(
    params: ReversalEntryParams,
    tx?: TxOrDb,
  ): Promise<JournalEntry>;

  /**
   * Create a credit note journal entry for a sale refund.
   * Debits revenue, credits cash (or AR).  If goods were returned, also
   * debits inventory and credits COGS.
   */
  createCreditNoteEntry(
    params: CreditNoteEntryParams,
    tx?: TxOrDb,
  ): Promise<JournalEntry>;

  /**
   * Reverse a cash payment: Credit Cash, Debit AR (or vice-versa for credit sales).
   */
  createPaymentReversalEntry(
    params: PaymentReversalEntryParams,
    tx?: TxOrDb,
  ): Promise<JournalEntry>;
}
