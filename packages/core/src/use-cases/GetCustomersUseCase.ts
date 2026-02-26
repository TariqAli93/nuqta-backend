import { ICustomerRepository } from '../interfaces/ICustomerRepository.js';

export class GetCustomersUseCase {
  constructor(private customerRepo: ICustomerRepository) {}

  async execute(params?: { search?: string; limit?: number; offset?: number }) {
    return await this.customerRepo.findAll(params);
  }
}
