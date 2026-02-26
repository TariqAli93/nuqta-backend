import { ISupplierLedgerRepository } from '../../interfaces/ISupplierLedgerRepository.js';
import { SupplierLedgerEntry } from '../../entities/Ledger.js';

export class GetSupplierLedgerUseCase {
  constructor(private ledgerRepo: ISupplierLedgerRepository) {}

  async execute(params: {
    supplierId: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SupplierLedgerEntry[]; total: number }> {
    return this.ledgerRepo.findAll(params);
  }
}
