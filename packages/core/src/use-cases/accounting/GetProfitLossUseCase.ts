import { IAccountingRepository } from '../../interfaces/IAccountingRepository.js';

export class GetProfitLossUseCase {
  constructor(private repo: IAccountingRepository) {}

  async execute(params?: { dateFrom?: string; dateTo?: string }) {
    return this.repo.getProfitLoss(params);
  }
}
