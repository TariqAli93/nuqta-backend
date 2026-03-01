import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { PostingBatch } from "../../entities/PostingBatch.js";
import {
  InvalidStateError,
  ValidationError,
} from "../../errors/DomainErrors.js";
import { MODULE_SETTING_KEYS } from "../../entities/ModuleSettings.js";

export interface PostPeriodInput {
  periodType: "day" | "month" | "year";
  periodStart: string; // ISO date string
  periodEnd: string; // ISO date string
  notes?: string;
}

/**
 * PostPeriodUseCase
 * Batch-posts all unposted journal entries within a date range.
 * Creates a posting_batch record and marks entries as posted.
 *
 * Rules:
 * - Only balanced entries can be posted (debit == credit)
 * - Accounting must be enabled
 * - Period must be valid (start <= end)
 */
export class PostPeriodUseCase {
  constructor(
    private postingRepo: IPostingRepository,
    private settingsRepo: ISettingsRepository,
  ) {}

  async execute(input: PostPeriodInput, userId: number): Promise<PostingBatch> {
    // Check accounting is enabled
    const accountingEnabled =
      (await this.settingsRepo.get(MODULE_SETTING_KEYS.ACCOUNTING_ENABLED)) ??
      (await this.settingsRepo.get("modules.accounting.enabled"));
    if (accountingEnabled === "false") {
      throw new InvalidStateError(
        "Accounting is not enabled. Cannot post entries.",
      );
    }

    // Validate dates
    if (!input.periodStart || !input.periodEnd) {
      throw new ValidationError("Period start and end dates are required");
    }
    if (input.periodStart > input.periodEnd) {
      throw new ValidationError(
        "Period start must be before or equal to period end",
      );
    }

    // Get unposted entries for the period
    const entries = await this.postingRepo.getUnpostedEntries(
      input.periodStart,
      input.periodEnd,
    );

    if (entries.length === 0) {
      throw new InvalidStateError(
        "No unposted entries found for the specified period",
        {
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        },
      );
    }

    for (const entry of entries) {
      const lines = entry.lines || [];
      if (lines.length === 0) {
        throw new InvalidStateError("Cannot post journal entry without lines", {
          entryId: entry.id,
          entryNumber: entry.entryNumber,
        });
      }
      const debit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const credit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
      if (debit !== credit) {
        throw new InvalidStateError("Cannot post unbalanced journal entry", {
          entryId: entry.id,
          entryNumber: entry.entryNumber,
          debit,
          credit,
        });
      }
    }

    // Calculate totals
    const totalAmount = entries.reduce(
      (sum, e) => sum + (e.totalAmount || 0),
      0,
    );
    const entryIds = entries.map((e) => e.id!).filter((id) => id != null);

    // Create posting batch
    const batch = await this.postingRepo.createBatch({
      periodType: input.periodType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      entriesCount: entryIds.length,
      totalAmount,
      status: "posted",
      postedAt: new Date(),
      postedBy: userId,
      notes: input.notes,
    });

    // Mark entries as posted
    await this.postingRepo.markEntriesAsPosted(entryIds, batch.id!);

    return batch;
  }
}
