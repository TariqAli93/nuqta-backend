import { IProductRepository } from '../../interfaces/IProductRepository.js';
import { IAuditRepository } from '../../interfaces/IAuditRepository.js';
import { AuditService } from '../../shared/services/AuditService.js';
import { Product } from '../../entities/Product.js';
import { ValidationError } from '../../shared/errors/DomainErrors.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { id: number; productData: Partial<Product> };

export class UpdateProductUseCase extends WriteUseCase<TInput, Product, Product> {
  private auditService: AuditService;

  constructor(
    private productRepo: IProductRepository,
    private auditRepo?: IAuditRepository
  ) {
    super();
    this.auditService = new AuditService(auditRepo as IAuditRepository);
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<Product> {
    if (input.productData.name !== undefined && input.productData.name.trim().length === 0) {
      throw new ValidationError('Product name cannot be empty');
    }

    if (input.productData.costPrice !== undefined && input.productData.costPrice < 0) {
      throw new ValidationError('Cost price must be non-negative');
    }

    if (input.productData.sellingPrice !== undefined && input.productData.sellingPrice < 0) {
      throw new ValidationError('Selling price must be non-negative');
    }

    if (input.productData.stock !== undefined && input.productData.stock < 0) {
      throw new ValidationError('Stock must be non-negative');
    }

    return await this.productRepo.update(input.id, input.productData);
  }

  async executeSideEffectsPhase(updated: Product, _userId: string): Promise<void> {
    // Fire-and-forget audit
    this.auditService
      .logUpdate(
        0,
        'product',
        updated.id!,
        Object.fromEntries(
          Object.entries(updated).map(([k, v]) => [k, { old: undefined, new: v }])
        ),
        `Product #${updated.id} updated`
      )
      .catch(() => {});
  }

  toEntity(result: Product): Product {
    return result;
  }
}
