import { IAccountingRepository } from '../../interfaces/IAccountingRepository.js';
import { Account } from '../../entities/Accounting.js';

export class GetAccountsUseCase {
  constructor(private repo: IAccountingRepository) {}

  async execute(): Promise<Account[]> {
    return this.repo.getAccounts();
  }
}
