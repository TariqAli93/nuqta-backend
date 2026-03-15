import { Employee } from "../../entities/Employee.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";
import { IEmployeeRepository } from "../../interfaces/IEmployeeRepository.js";

export class CreateEmployeeUseCase {
  constructor(private employeeRepo: IEmployeeRepository) {}

  async execute(employee: Employee) {
    this.validate(employee);
    return await this.employeeRepo.create(employee);
  }

  private validate(employee: Employee) {
    if (!employee.name || employee.name.trim().length === 0) {
      throw new ValidationError("Employee name is required");
    }
    if (!employee.position || employee.position.trim().length === 0) {
      throw new ValidationError("Employee position is required");
    }
    if (!employee.department || employee.department.trim().length === 0) {
      throw new ValidationError("Employee department is required");
    }
    if (!Number.isInteger(employee.salary) || employee.salary < 0) {
      throw new ValidationError("Employee salary must be a non-negative integer", {
        salary: employee.salary,
      });
    }
  }
}
