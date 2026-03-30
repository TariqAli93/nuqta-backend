import { NotFoundError, ValidationError } from "../../shared/errors/DomainErrors.js";
import { IEmployeeRepository } from "../../interfaces/IEmployeeRepository.js";
import { Employee } from "../../entities/Employee.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { id: number; employee: Partial<Employee> };

export class UpdateEmployeeUseCase extends WriteUseCase<TInput, Employee, Employee> {
  constructor(private employeeRepo: IEmployeeRepository) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<Employee> {
    const existing = await this.employeeRepo.findById(input.id);
    if (!existing) {
      throw new NotFoundError("Employee not found", { employeeId: input.id });
    }

    if (input.employee.name !== undefined && input.employee.name.trim().length === 0) {
      throw new ValidationError("Employee name cannot be empty");
    }
    if (
      input.employee.position !== undefined &&
      input.employee.position.trim().length === 0
    ) {
      throw new ValidationError("Employee position cannot be empty");
    }
    if (
      input.employee.departmentId !== undefined &&
      (!Number.isInteger(input.employee.departmentId) ||
        input.employee.departmentId <= 0)
    ) {
      throw new ValidationError("Employee departmentId must be a positive integer");
    }
    if (
      input.employee.salary !== undefined &&
      (!Number.isInteger(input.employee.salary) || input.employee.salary < 0)
    ) {
      throw new ValidationError(
        "Employee salary must be a non-negative integer",
        {
          salary: input.employee.salary,
        },
      );
    }

    return await this.employeeRepo.update(input.id, input.employee);
  }

  executeSideEffectsPhase(_result: Employee, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Employee): Employee {
    return result;
  }
}
