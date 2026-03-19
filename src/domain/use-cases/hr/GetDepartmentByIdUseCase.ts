import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { IDepartmentRepository } from "../../interfaces/IDepartmentRepository.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetDepartmentByIdUseCase extends ReadUseCase<
  number,
  Awaited<ReturnType<IDepartmentRepository["findById"]>>
> {
  constructor(private departmentRepo: IDepartmentRepository) {
    super();
  }

  async execute(id: number) {
    const department = await this.departmentRepo.findById(id);
    if (!department) {
      throw new NotFoundError("Department not found", { departmentId: id });
    }
    return department;
  }
}
