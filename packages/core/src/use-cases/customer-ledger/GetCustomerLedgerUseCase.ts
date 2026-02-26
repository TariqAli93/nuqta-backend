import { ICustomerLedgerRepository } from '../../interfaces/ICustomerLedgerRepository.js';
import { CustomerLedgerEntry } from '../../entities/Ledger.js';

export class GetCustomerLedgerUseCase {
  constructor(private ledgerRepo: ICustomerLedgerRepository) {}

  async execute(params: {
    customerId: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CustomerLedgerEntry[]; total: number }> {
    return this.ledgerRepo.findAll(params);
  }
}
