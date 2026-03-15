import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { IPayrollRepository } from "../../interfaces/IPayrollRepository.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetPayrollRunByIdUseCase extends ReadUseCase<number, Awaited<ReturnType<IPayrollRepository["findById"]>>> {
  constructor(private payrollRepo: IPayrollRepository) {
    super();
  }

  async execute(id: number) {
    const run = await this.payrollRepo.findById(id);
    if (!run) {
      throw new NotFoundError("Payroll run not found", { payrollRunId: id });
    }
    return run;
  }
}
