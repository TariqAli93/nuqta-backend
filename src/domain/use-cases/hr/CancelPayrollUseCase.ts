import { WriteUseCase } from "../../shared/WriteUseCase.js";
import { PayrollStateMachine } from "../../shared/PayrollStateMachine.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import type { IPayrollRepository } from "../../interfaces/IPayrollRepository.js";
import type { PayrollRun } from "../../entities/Payroll.js";

export interface CancelPayrollInput {
  payrollRunId: number;
  reason?: string;
}

/**
 * CancelPayrollUseCase — cancels a payroll run.
 *
 * Valid from: draft, submitted.
 * Approved and disbursed runs cannot be cancelled (InvalidStateError).
 */
export class CancelPayrollUseCase extends WriteUseCase<
  CancelPayrollInput,
  PayrollRun,
  PayrollRun
> {
  constructor(private payrollRepo: IPayrollRepository) {
    super();
  }

  async executeCommitPhase(
    input: CancelPayrollInput,
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
      "cancelled",
      input.payrollRunId,
    );

    return this.payrollRepo.updateStatus(input.payrollRunId, "cancelled");
  }

  executeSideEffectsPhase(_result: PayrollRun, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: PayrollRun): PayrollRun {
    return result;
  }
}
