import { IProductRepository } from '../interfaces/IProductRepository.js';
import { IAuditRepository } from '../interfaces/IAuditRepository.js';
import { AuditService } from '../services/AuditService.js';

export class DeleteProductUseCase {
  private auditService: AuditService;

  constructor(
    private productRepo: IProductRepository,
    private auditRepo?: IAuditRepository
  ) {
    this.auditService = new AuditService(auditRepo as IAuditRepository);
  }

  async execute(id: number): Promise<void> {
    await this.productRepo.delete(id);
    // Fire-and-forget audit
    this.auditService.logDelete(0, 'product', id, { id }).catch(() => {});
  }
}
