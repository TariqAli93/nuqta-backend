import { IAccountingRepository } from '../../interfaces/IAccountingRepository.js';
import { JournalEntry } from '../../entities/Accounting.js';

export class GetEntryByIdUseCase {
  constructor(private repo: IAccountingRepository) {}

  async execute(id: number): Promise<JournalEntry | null> {
    return this.repo.getEntryById(id);
  }
}
