import { ICustomerRepository } from '../interfaces/ICustomerRepository.js';
import { Customer } from '../entities/Customer.js';

import { ValidationError } from '../errors/DomainErrors.js';

export class CreateCustomerUseCase {
  constructor(private customerRepo: ICustomerRepository) {}

  async execute(customer: Customer) {
    if (!customer.name || customer.name.trim().length === 0) {
      throw new ValidationError('Customer name is required');
    }
    return await this.customerRepo.create(customer);
  }
}
