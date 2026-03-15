import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { IPayrollRepository } from "../../interfaces/IPayrollRepository.js";

export class GetPayrollRunByIdUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(id: number) {
    const run = await this.payrollRepo.findById(id);
    if (!run) {
      throw new NotFoundError("Payroll run not found", { payrollRunId: id });
    }
    return run;
  }
}
