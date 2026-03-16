/**
 * GetReconciliationsUseCase
 * Lists reconciliation records with optional filtering.
 */

import type { IReconciliationRepository } from "../../interfaces/IReconciliationRepository.js";
import type { Reconciliation } from "../../entities/Reconciliation.js";

export interface GetReconciliationsParams {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export class GetReconciliationsUseCase {
  constructor(private reconRepo: IReconciliationRepository) {}

  async execute(
    params: GetReconciliationsParams,
  ): Promise<{ items: Reconciliation[]; total: number }> {
    return this.reconRepo.findReconciliations(params);
  }
}
