import {
  NotFoundError,
  ValidationError,
} from "../../shared/errors/DomainErrors.js";
import { IDepartmentRepository } from "../../interfaces/IDepartmentRepository.js";
import { Department } from "../../entities/Department.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { id: number; department: Partial<Department> };

export class UpdateDepartmentUseCase extends WriteUseCase<
  TInput,
  Department,
  Department
> {
  constructor(private departmentRepo: IDepartmentRepository) {
    super();
  }

  async executeCommitPhase(
    input: TInput,
    _userId: string,
  ): Promise<Department> {
    const existing = await this.departmentRepo.findById(input.id);
    if (!existing) {
      throw new NotFoundError("Department not found", {
        departmentId: input.id,
      });
    }

    if (
      input.department.name !== undefined &&
      input.department.name.trim().length === 0
    ) {
      throw new ValidationError("Department name cannot be empty");
    }

    return await this.departmentRepo.update(input.id, input.department);
  }

  executeSideEffectsPhase(_result: Department, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Department): Department {
    return result;
  }
}
