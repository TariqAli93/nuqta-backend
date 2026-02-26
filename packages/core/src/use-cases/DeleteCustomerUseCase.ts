import { ICustomerRepository } from '../interfaces/ICustomerRepository.js';

export class DeleteCustomerUseCase {
  constructor(private customerRepo: ICustomerRepository) {}

  async execute(id: number) {
    return await this.customerRepo.delete(id);
  }
}
