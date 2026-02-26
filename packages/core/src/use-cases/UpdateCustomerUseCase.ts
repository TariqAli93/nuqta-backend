import { ICustomerRepository } from '../interfaces/ICustomerRepository.js';
import { Customer } from '../entities/Customer.js';

import { ValidationError } from '../errors/DomainErrors.js';

export class UpdateCustomerUseCase {
  constructor(private customerRepo: ICustomerRepository) {}

  async execute(id: number, customer: Partial<Customer>) {
    if (customer.name !== undefined && customer.name.trim().length === 0) {
      throw new ValidationError('Customer name cannot be empty');
    }
    return await this.customerRepo.update(id, customer);
  }
}
