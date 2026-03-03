/**
 * GetPostingBatchesUseCase
 * Lists all posting batches with optional filters.
 */
import { IPostingRepository } from "../../interfaces/IPostingRepository.js";

export class GetPostingBatchesUseCase {
  constructor(private postingRepo: IPostingRepository) {}

  async execute(params?: { status?: string; limit?: number; offset?: number }) {
    return this.postingRepo.getBatches(params);
  }
}
