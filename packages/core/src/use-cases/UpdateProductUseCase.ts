import { IProductRepository } from '../interfaces/IProductRepository.js';
import { IAuditRepository } from '../interfaces/IAuditRepository.js';
import { AuditService } from '../services/AuditService.js';
import { Product } from '../entities/Product.js';
import { ValidationError } from '../errors/DomainErrors.js';

export class UpdateProductUseCase {
  private auditService: AuditService;

  constructor(
    private productRepo: IProductRepository,
    private auditRepo?: IAuditRepository
  ) {
    this.auditService = new AuditService(auditRepo as IAuditRepository);
  }

  async execute(id: number, productData: Partial<Product>): Promise<Product> {
    if (productData.name !== undefined && productData.name.trim().length === 0) {
      throw new ValidationError('Product name cannot be empty');
    }

    if (productData.costPrice !== undefined && productData.costPrice < 0) {
      throw new ValidationError('Cost price must be non-negative');
    }

    if (productData.sellingPrice !== undefined && productData.sellingPrice < 0) {
      throw new ValidationError('Selling price must be non-negative');
    }

    if (productData.stock !== undefined && productData.stock < 0) {
      throw new ValidationError('Stock must be non-negative');
    }

    const updated = await this.productRepo.update(id, productData);
    // Fire-and-forget audit
    this.auditService
      .logUpdate(
        0,
        'product',
        id,
        Object.fromEntries(
          Object.entries(productData).map(([k, v]) => [k, { old: undefined, new: v }])
        ),
        `Product #${id} updated`
      )
      .catch(() => {});
    return updated;
  }
}
