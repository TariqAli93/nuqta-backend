import { IAccountingRepository } from '../../interfaces/IAccountingRepository.js';
import { JournalEntry } from '../../entities/Accounting.js';

export class GetJournalEntriesUseCase {
  constructor(private repo: IAccountingRepository) {}

  async execute(params?: {
    sourceType?: string;
    dateFrom?: string;
    dateTo?: string;
    isPosted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: JournalEntry[]; total: number }> {
    return this.repo.getJournalEntries(params);
  }
}
