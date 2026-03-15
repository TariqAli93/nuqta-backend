import { ICustomerRepository } from '../../interfaces/ICustomerRepository.js';
import { Customer } from '../../entities/Customer.js';
import { ValidationError } from '../../shared/errors/DomainErrors.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export class CreateCustomerUseCase extends WriteUseCase<Customer, Customer, Customer> {
  constructor(private customerRepo: ICustomerRepository) {
    super();
  }

  async executeCommitPhase(customer: Customer, _userId: string): Promise<Customer> {
    if (!customer.name || customer.name.trim().length === 0) {
      throw new ValidationError('Customer name is required');
    }
    return await this.customerRepo.create(customer);
  }

  executeSideEffectsPhase(_result: Customer, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Customer): Customer {
    return result;
  }
}
