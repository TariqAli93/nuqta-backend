/**
 * GetCustomerByIdUseCase
 * Fetches a single customer by ID.
 */
import { ICustomerRepository } from "../../interfaces/ICustomerRepository.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";

export class GetCustomerByIdUseCase {
  constructor(private customerRepo: ICustomerRepository) {}

  async execute(id: number) {
    const customer = await this.customerRepo.findById(id);
    if (!customer) {
      throw new NotFoundError("العميل غير موجود");
    }
    return customer;
  }
}
