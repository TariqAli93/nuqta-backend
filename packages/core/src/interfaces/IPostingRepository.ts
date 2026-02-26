import { PostingBatch } from "../entities/PostingBatch.js";
import { JournalEntry } from "../entities/Accounting.js";

export interface IPostingRepository {
  /** Create a posting batch record */
  createBatch(
    batch: Omit<PostingBatch, "id" | "createdAt">,
  ): Promise<PostingBatch>;

  /** Get all posting batches with optional filters */
  getBatches(params?: {
    periodType?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: PostingBatch[]; total: number }>;

  /** Get a single batch by ID */
  getBatchById(id: number): Promise<PostingBatch | null>;

  /** Get unposted journal entries for a date range */
  getUnpostedEntries(
    startDate: string,
    endDate: string,
  ): Promise<JournalEntry[]>;

  /** Get posted journal entry ids belonging to a posting batch */
  getPostedEntryIdsByBatch(batchId: number): Promise<number[]>;

  /** Post a single journal entry manually */
  postIndividualEntry(entryId: number): Promise<void>;

  /** Unpost a single journal entry manually */
  unpostIndividualEntry(entryId: number): Promise<void>;

  /** Mark journal entries as posted in a batch (update isPosted + postingBatchId) */
  markEntriesAsPosted(entryIds: number[], batchId: number): Promise<number>;

  /** Create a reversing journal entry for a posted entry */
  createReversalEntry(
    originalEntryId: number,
    userId: number,
  ): Promise<JournalEntry>;

  /** Void an unposted journal entry by marking it as reversed (no counter-entry needed) */
  voidUnpostedEntry(entryId: number): Promise<void>;

  /** Lock a posting batch — prevents further edits to its entries */
  lockBatch(batchId: number): Promise<void>;

  /** Unlock a posting batch — re-opens it for amendments */
  unlockBatch(batchId: number): Promise<void>;

  /** Check whether a batch is locked */
  isBatchLocked(batchId: number): Promise<boolean>;
}
