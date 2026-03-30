import { Employee } from "../../entities/Employee.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";
import { IEmployeeRepository } from "../../interfaces/IEmployeeRepository.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export class CreateEmployeeUseCase extends WriteUseCase<Employee, Employee, Employee> {
  constructor(private employeeRepo: IEmployeeRepository) {
    super();
  }

  async executeCommitPhase(employee: Employee, _userId: string): Promise<Employee> {
    this.validate(employee);
    return await this.employeeRepo.create(employee);
  }

  executeSideEffectsPhase(_result: Employee, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Employee): Employee {
    return result;
  }

  private validate(employee: Employee) {
    if (!employee.name || employee.name.trim().length === 0) {
      throw new ValidationError("Employee name is required");
    }
    if (!employee.position || employee.position.trim().length === 0) {
      throw new ValidationError("Employee position is required");
    }
    if (!Number.isInteger(employee.departmentId) || employee.departmentId <= 0) {
      throw new ValidationError("Employee departmentId is required");
    }
    if (!Number.isInteger(employee.salary) || employee.salary < 0) {
      throw new ValidationError("Employee salary must be a non-negative integer", {
        salary: employee.salary,
      });
    }
  }
}
