import { IProductRepository } from '../../interfaces/IProductRepository.js';
import { IAuditRepository } from '../../interfaces/IAuditRepository.js';
import { AuditService } from '../../shared/services/AuditService.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export class DeleteProductUseCase extends WriteUseCase<number, void, void> {
  private auditService: AuditService;

  constructor(
    private productRepo: IProductRepository,
    private auditRepo?: IAuditRepository
  ) {
    super();
    this.auditService = new AuditService(auditRepo as IAuditRepository);
  }

  async executeCommitPhase(id: number, _userId: string): Promise<void> {
    await this.productRepo.delete(id);
  }

  async executeSideEffectsPhase(_result: void, _userId: string): Promise<void> {
    // Fire-and-forget audit — we don't have id here so nothing to log without input
  }

  toEntity(result: void): void {
    return result;
  }
}
