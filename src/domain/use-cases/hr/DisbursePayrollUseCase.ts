import { WriteUseCase } from "../../shared/WriteUseCase.js";
import { PayrollStateMachine } from "../../shared/PayrollStateMachine.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import type { IPayrollRepository } from "../../interfaces/IPayrollRepository.js";
import type { PayrollRun } from "../../entities/Payroll.js";

export interface DisbursePayrollInput {
  payrollRunId: number;
}

/**
 * DisbursePayrollUseCase — transitions a payroll run from approved → disbursed.
 * Called after the actual cash/bank transfer has been executed.
 */
export class DisbursePayrollUseCase extends WriteUseCase<
  DisbursePayrollInput,
  PayrollRun,
  PayrollRun
> {
  constructor(private payrollRepo: IPayrollRepository) {
    super();
  }

  async executeCommitPhase(
    input: DisbursePayrollInput,
    _userId: string,
  ): Promise<PayrollRun> {
    const run = await this.payrollRepo.findById(input.payrollRunId);
    if (!run) {
      throw new NotFoundError("Payroll run not found", {
        payrollRunId: input.payrollRunId,
      });
    }

    const currentStatus = (run.status ?? "draft") as Parameters<
      typeof PayrollStateMachine.transition
    >[0];

    PayrollStateMachine.transition(
      currentStatus,
      "disbursed",
      input.payrollRunId,
    );

    return this.payrollRepo.updateStatus(input.payrollRunId, "disbursed");
  }

  executeSideEffectsPhase(_result: PayrollRun, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: PayrollRun): PayrollRun {
    return result;
  }
}
