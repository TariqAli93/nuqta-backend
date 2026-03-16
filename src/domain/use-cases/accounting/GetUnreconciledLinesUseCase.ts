/**
 * GetUnreconciledLinesUseCase
 *
 * Returns the candidate journal lines that can be fed into the reconcile
 * endpoint.  Supports three query modes:
 *   - by partner + account:  e.g. all open AR lines for customer #5
 *   - by account only:       e.g. all unreconciled AP lines
 *   - by line IDs:           preview of specific lines
 */

import type { IReconciliationRepository } from "../../interfaces/IReconciliationRepository.js";
import type { ReconciliableJournalLine } from "../../entities/Reconciliation.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";

export interface GetUnreconciledLinesParams {
  partnerId?: number;
  accountCode?: string;
  lineIds?: number[];
}

export class GetUnreconciledLinesUseCase {
  constructor(private reconRepo: IReconciliationRepository) {}

  async execute(
    params: GetUnreconciledLinesParams,
  ): Promise<ReconciliableJournalLine[]> {
    if (params.lineIds && params.lineIds.length > 0) {
      return this.reconRepo.findJournalLinesByIds(params.lineIds);
    }

    if (params.partnerId && params.accountCode) {
      return this.reconRepo.findUnreconciledLinesByPartner({
        partnerId: params.partnerId,
        accountCode: params.accountCode,
      });
    }

    if (params.accountCode) {
      return this.reconRepo.findUnreconciledLinesByAccount({
        accountCode: params.accountCode,
      });
    }

    throw new ValidationError(
      "Provide at least one of: lineIds, accountCode, or partnerId+accountCode",
    );
  }
}
