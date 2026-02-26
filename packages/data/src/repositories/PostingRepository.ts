import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { DbConnection } from "../db.js";
import {
  postingBatches,
  journalEntries,
  journalLines,
  accounts,
} from "../schema/schema.js";
import { IPostingRepository, PostingBatch, JournalEntry } from "@nuqta/core";

export class PostingRepository implements IPostingRepository {
  constructor(private db: DbConnection) {}

  async createBatch(
    batch: Omit<PostingBatch, "id" | "createdAt">,
  ): Promise<PostingBatch> {
    const [created] = await this.db
      .insert(postingBatches)
      .values(batch as any)
      .returning();
    return created as unknown as PostingBatch;
  }

  async getBatches(params?: {
    periodType?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: PostingBatch[]; total: number }> {
    const conditions: any[] = [];
    if (params?.periodType)
      conditions.push(eq(postingBatches.periodType, params.periodType));
    if (params?.dateFrom)
      conditions.push(gte(postingBatches.periodStart, params.dateFrom));
    if (params?.dateTo)
      conditions.push(lte(postingBatches.periodEnd, params.dateTo));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(postingBatches)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db
      .select()
      .from(postingBatches)
      .where(where)
      .orderBy(desc(postingBatches.id))
      .$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const rows = await query;
    return { items: rows as unknown as PostingBatch[], total };
  }

  async getBatchById(id: number): Promise<PostingBatch | null> {
    const [row] = await this.db
      .select()
      .from(postingBatches)
      .where(eq(postingBatches.id, id));
    return (row as unknown as PostingBatch) || null;
  }

  async getUnpostedEntries(
    startDate: string,
    endDate: string,
  ): Promise<JournalEntry[]> {
    const rows = await this.db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.isPosted, false),
          gte(journalEntries.entryDate, new Date(startDate)),
          lte(journalEntries.entryDate, new Date(endDate)),
          sql`COALESCE(${journalEntries.isReversed}, false) = false`,
        ),
      )
      .orderBy(journalEntries.entryDate);

    return Promise.all(
      rows.map(async (row) => {
        const lines = await this.db
          .select()
          .from(journalLines)
          .where(eq(journalLines.journalEntryId, row.id));
        return { ...row, lines } as unknown as JournalEntry;
      }),
    );
  }

  async getPostedEntryIdsByBatch(batchId: number): Promise<number[]> {
    const rows = await this.db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(eq(journalEntries.postingBatchId, batchId));
    return rows.map((r) => r.id);
  }

  async postIndividualEntry(entryId: number): Promise<void> {
    await this.db
      .update(journalEntries)
      .set({ isPosted: true } as any)
      .where(eq(journalEntries.id, entryId));
  }

  async unpostIndividualEntry(entryId: number): Promise<void> {
    await this.db
      .update(journalEntries)
      .set({ isPosted: false, postingBatchId: null } as any)
      .where(eq(journalEntries.id, entryId));
  }

  async markEntriesAsPosted(
    entryIds: number[],
    batchId: number,
  ): Promise<number> {
    if (entryIds.length === 0) return 0;

    const updated = await this.db
      .update(journalEntries)
      .set({ isPosted: true, postingBatchId: batchId } as any)
      .where(inArray(journalEntries.id, entryIds))
      .returning({ id: journalEntries.id });
    return updated.length;
  }

  async createReversalEntry(
    originalEntryId: number,
    userId: number,
  ): Promise<JournalEntry> {
    const original = await this.getEntryWithLines(originalEntryId);
    if (!original) throw new Error(`Entry ${originalEntryId} not found`);

    // Generate reversal entry number
    const entryNumber = `REV-${original.entryNumber}-${Date.now()}`;

    const [reversal] = await this.db
      .insert(journalEntries)
      .values({
        entryNumber,
        entryDate: new Date(),
        description: `عكس القيد: ${original.description}`,
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        isPosted: true,
        isReversed: false,
        reversalOfId: original.id,
        totalAmount: original.totalAmount,
        currency: original.currency,
        notes: `Reversal of entry #${original.id}`,
        createdBy: userId,
      } as any)
      .returning();

    // Reverse lines (swap debit/credit)
    if (original.lines && original.lines.length > 0) {
      const reversedLines = original.lines.map((line: any) => ({
        journalEntryId: reversal.id,
        accountId: line.accountId,
        debit: line.credit || 0,
        credit: line.debit || 0,
        description: line.description,
      }));
      await this.db.insert(journalLines).values(reversedLines as any);

      // Update account balances (reverse the amounts)
      for (const line of original.lines as any[]) {
        const netReverse = (line.credit || 0) - (line.debit || 0);
        await this.db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${netReverse}`,
          } as any)
          .where(eq(accounts.id, line.accountId));
      }
    }

    // Mark original as reversed
    await this.db
      .update(journalEntries)
      .set({ isReversed: true } as any)
      .where(eq(journalEntries.id, originalEntryId));

    const result = await this.getEntryWithLines(reversal.id);
    return result as JournalEntry;
  }

  async voidUnpostedEntry(entryId: number): Promise<void> {
    await this.db
      .update(journalEntries)
      .set({ isReversed: true } as any)
      .where(eq(journalEntries.id, entryId));
  }

  async lockBatch(batchId: number): Promise<void> {
    await this.db
      .update(postingBatches)
      .set({ status: "locked" } as any)
      .where(eq(postingBatches.id, batchId));
  }

  async unlockBatch(batchId: number): Promise<void> {
    await this.db
      .update(postingBatches)
      .set({ status: "posted" } as any)
      .where(eq(postingBatches.id, batchId));
  }

  async isBatchLocked(batchId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ status: postingBatches.status })
      .from(postingBatches)
      .where(eq(postingBatches.id, batchId));
    return row?.status === "locked";
  }

  // ── Private helpers ───────────────────────────────────────────

  private async getEntryWithLines(id: number): Promise<JournalEntry | null> {
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
}
