import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { IEmployeeRepository } from "../../interfaces/IEmployeeRepository.js";

export class GetEmployeeByIdUseCase {
  constructor(private employeeRepo: IEmployeeRepository) {}

  async execute(id: number) {
    const employee = await this.employeeRepo.findById(id);
    if (!employee) {
      throw new NotFoundError("Employee not found", { employeeId: id });
    }
    return employee;
  }
}
