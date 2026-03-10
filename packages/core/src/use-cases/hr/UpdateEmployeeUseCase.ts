import { NotFoundError, ValidationError } from "../../shared/errors/DomainErrors.js";
import { IEmployeeRepository } from "../../interfaces/IEmployeeRepository.js";
import { Employee } from "../../entities/Employee.js";

export class UpdateEmployeeUseCase {
  constructor(private employeeRepo: IEmployeeRepository) {}

  async execute(id: number, employee: Partial<Employee>) {
    const existing = await this.employeeRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Employee not found", { employeeId: id });
    }

    if (employee.name !== undefined && employee.name.trim().length === 0) {
      throw new ValidationError("Employee name cannot be empty");
    }
    if (
      employee.position !== undefined &&
      employee.position.trim().length === 0
    ) {
      throw new ValidationError("Employee position cannot be empty");
    }
    if (
      employee.department !== undefined &&
      employee.department.trim().length === 0
    ) {
      throw new ValidationError("Employee department cannot be empty");
    }
    if (
      employee.salary !== undefined &&
      (!Number.isInteger(employee.salary) || employee.salary < 0)
    ) {
      throw new ValidationError(
        "Employee salary must be a non-negative integer",
        {
          salary: employee.salary,
        },
      );
    }

    return await this.employeeRepo.update(id, employee);
  }
}
