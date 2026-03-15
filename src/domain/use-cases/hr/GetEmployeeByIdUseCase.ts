import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { IEmployeeRepository } from "../../interfaces/IEmployeeRepository.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetEmployeeByIdUseCase extends ReadUseCase<number, Awaited<ReturnType<IEmployeeRepository["findById"]>>> {
  constructor(private employeeRepo: IEmployeeRepository) {
    super();
  }

  async execute(id: number) {
    const employee = await this.employeeRepo.findById(id);
    if (!employee) {
      throw new NotFoundError("Employee not found", { employeeId: id });
    }
    return employee;
  }
}
