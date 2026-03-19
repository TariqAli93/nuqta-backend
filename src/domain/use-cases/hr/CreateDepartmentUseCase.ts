import { Department } from "../../entities/Department.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";
import { IDepartmentRepository } from "../../interfaces/IDepartmentRepository.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export class CreateDepartmentUseCase extends WriteUseCase<
  Department,
  Department,
  Department
> {
  constructor(private departmentRepo: IDepartmentRepository) {
    super();
  }

  async executeCommitPhase(
    department: Department,
    _userId: string,
  ): Promise<Department> {
    if (!department.name || department.name.trim().length === 0) {
      throw new ValidationError("Department name is required");
    }
    return await this.departmentRepo.create(department);
  }

  executeSideEffectsPhase(_result: Department, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Department): Department {
    return result;
  }
}
