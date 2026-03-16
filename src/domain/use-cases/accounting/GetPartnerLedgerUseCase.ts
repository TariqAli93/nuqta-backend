/**
 * GetPartnerLedgerUseCase
 *
 * Returns the accounting-based AR/AP ledger for a customer or supplier.
 * Unlike the simple customer_ledger / supplier_ledger tables (which are
 * denormalized running-balance stores), this view reads directly from the
 * journal lines so it always reflects the true double-entry state.
 */

import type { IReconciliationRepository } from "../../interfaces/IReconciliationRepository.js";
import type { PartnerLedger } from "../../entities/Reconciliation.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";

export interface GetPartnerLedgerInput {
  partnerId: number;
  partnerType: "customer" | "supplier";
}

export class GetPartnerLedgerUseCase {
  constructor(private reconRepo: IReconciliationRepository) {}

  async execute(input: GetPartnerLedgerInput): Promise<PartnerLedger> {
    if (!input.partnerId || input.partnerId <= 0) {
      throw new ValidationError("partnerId must be a positive integer");
    }

    if (input.partnerType === "customer") {
      return this.reconRepo.getCustomerLedger(input.partnerId);
    }
    if (input.partnerType === "supplier") {
      return this.reconRepo.getSupplierLedger(input.partnerId);
    }

    throw new ValidationError("partnerType must be customer or supplier");
  }
}
