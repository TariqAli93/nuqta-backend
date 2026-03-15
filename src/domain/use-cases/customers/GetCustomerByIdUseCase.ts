/**
 * GetCustomerByIdUseCase
 * Fetches a single customer by ID.
 */
import { ICustomerRepository } from "../../interfaces/ICustomerRepository.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetCustomerByIdUseCase extends ReadUseCase<number, Awaited<ReturnType<ICustomerRepository["findById"]>>> {
  constructor(private customerRepo: ICustomerRepository) {
    super();
  }

  async execute(id: number) {
    const customer = await this.customerRepo.findById(id);
    if (!customer) {
      throw new NotFoundError("العميل غير موجود");
    }
    return customer;
  }
}
