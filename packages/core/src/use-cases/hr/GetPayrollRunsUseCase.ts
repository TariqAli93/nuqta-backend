import { IPayrollRepository } from "../../interfaces/IPayrollRepository.js";

export class GetPayrollRunsUseCase {
  constructor(private payrollRepo: IPayrollRepository) {}

  async execute(params?: {
    status?: "draft" | "approved";
    periodYear?: number;
    periodMonth?: number;
    limit?: number;
    offset?: number;
  }) {
    return await this.payrollRepo.findAll(params);
  }
}
