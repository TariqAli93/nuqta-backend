import { IAccountingRepository } from '../../interfaces/IAccountingRepository.js';

export class GetTrialBalanceUseCase {
  constructor(private repo: IAccountingRepository) {}

  async execute(params?: { dateFrom?: string; dateTo?: string }) {
    return this.repo.getTrialBalance(params);
  }
}
