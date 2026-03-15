import { ICustomerRepository } from '../../interfaces/ICustomerRepository.js';
import { Customer } from '../../entities/Customer.js';
import { ValidationError } from '../../shared/errors/DomainErrors.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { id: number; customer: Partial<Customer> };

export class UpdateCustomerUseCase extends WriteUseCase<TInput, Customer, Customer> {
  constructor(private customerRepo: ICustomerRepository) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<Customer> {
    if (input.customer.name !== undefined && input.customer.name.trim().length === 0) {
      throw new ValidationError('Customer name cannot be empty');
    }
    return await this.customerRepo.update(input.id, input.customer);
  }

  executeSideEffectsPhase(_result: Customer, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Customer): Customer {
    return result;
  }
}
