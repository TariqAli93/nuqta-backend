import { WriteUseCase } from "../../shared/WriteUseCase.js";
import { PayrollStateMachine } from "../../shared/PayrollStateMachine.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import type { IPayrollRepository } from "../../interfaces/IPayrollRepository.js";
import type { PayrollRun } from "../../entities/Payroll.js";

export interface SubmitPayrollInput {
  payrollRunId: number;
}

/**
 * SubmitPayrollUseCase — transitions a payroll run from draft → submitted.
 * Submitted runs are locked for editing and await manager approval.
 */
export class SubmitPayrollUseCase extends WriteUseCase<
  SubmitPayrollInput,
  PayrollRun,
  PayrollRun
> {
  constructor(private payrollRepo: IPayrollRepository) {
    super();
  }

  async executeCommitPhase(
    input: SubmitPayrollInput,
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
      "submitted",
      input.payrollRunId,
    );

    return this.payrollRepo.updateStatus(input.payrollRunId, "submitted");
  }

  executeSideEffectsPhase(_result: PayrollRun, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: PayrollRun): PayrollRun {
    return result;
  }
}
