import type { JournalLine } from "../../entities/Accounting.js";
import {
  InvalidStateError,
  NotFoundError,
} from "../../shared/errors/DomainErrors.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { IPayrollRepository } from "../../interfaces/IPayrollRepository.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { id: number; userId?: number } | number;
type TEntity = Awaited<ReturnType<IPayrollRepository["approve"]>>;

export class ApprovePayrollRunUseCase extends WriteUseCase<
  TInput,
  TEntity,
  TEntity
> {
  constructor(
    private payrollRepo: IPayrollRepository,
    private accountingRepo: IAccountingRepository,
  ) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<TEntity> {
    const id = typeof input === "number" ? input : input.id;
    const userId =
      typeof input === "number"
        ? Number(_userId) || 0
        : (input.userId ?? (Number(_userId) || 0));
    const run = await this.payrollRepo.findById(id);
    if (!run) {
      throw new NotFoundError("Payroll run not found", { payrollRunId: id });
    }
    if (run.status === "approved") {
      throw new InvalidStateError("Payroll run is already approved", {
        payrollRunId: id,
      });
    }

    const salaryExpenseAccount = await this.accountingRepo.findAccountByCode(
      run.salaryExpenseAccountCode,
    );
    if (!salaryExpenseAccount?.id) {
      throw new NotFoundError("Salary expense account not found", {
        accountCode: run.salaryExpenseAccountCode,
      });
    }

    const paymentAccount = await this.accountingRepo.findAccountByCode(
      run.paymentAccountCode,
    );
    if (!paymentAccount?.id) {
      throw new NotFoundError("Payroll payment account not found", {
        accountCode: run.paymentAccountCode,
      });
    }

    const totalGrossPay =
      run.items?.reduce((sum, item) => sum + item.grossPay, 0) ??
      run.totalGrossPay;
    const totalBonuses =
      run.items?.reduce((sum, item) => sum + item.bonuses, 0) ??
      run.totalBonuses;
    const totalDeductions =
      run.items?.reduce((sum, item) => sum + item.deductions, 0) ??
      run.totalDeductions;
    const totalNetPay =
      run.items?.reduce((sum, item) => sum + item.netPay, 0) ?? run.totalNetPay;
    const totalExpense = totalGrossPay + totalBonuses;

    let deductionsLiabilityAccount: Awaited<
      ReturnType<IAccountingRepository["findAccountByCode"]>
    > | null = null;
    if (totalDeductions > 0) {
      deductionsLiabilityAccount = await this.accountingRepo.findAccountByCode(
        run.deductionsLiabilityAccountCode,
      );
      if (!deductionsLiabilityAccount?.id) {
        throw new NotFoundError(
          "Payroll deductions liability account not found",
          {
            accountCode: run.deductionsLiabilityAccountCode,
          },
        );
      }
    }

    const lines: JournalLine[] = [
      {
        accountId: salaryExpenseAccount.id,
        debit: totalExpense,
        credit: 0,
        description: `Payroll expense for ${this.formatPeriod(run.periodYear, run.periodMonth)}`,
        balance: 0,
        reconciled: false,
      },
    ];

    if (totalDeductions > 0 && deductionsLiabilityAccount?.id) {
      lines.push({
        accountId: deductionsLiabilityAccount.id,
        debit: 0,
        credit: totalDeductions,
        description: "Payroll deductions payable",
        balance: 0,
        reconciled: false,
      });
    }

    lines.push({
      accountId: paymentAccount.id,
      debit: 0,
      credit: totalNetPay,
      description: "Payroll cash/bank disbursement",
      balance: 0,
      reconciled: false,
    });

    const journalEntry = await this.accountingRepo.createJournalEntrySync({
      entryNumber: `JE-PAYROLL-${id}`,
      entryDate: run.paymentDate || new Date(),
      description: `Payroll approval for ${this.formatPeriod(run.periodYear, run.periodMonth)}`,
      sourceType: "manual",
      sourceId: id,
      isPosted: false,
      isReversed: false,
      totalAmount: totalExpense,
      currency: "IQD",
      notes: `Generated from payroll run #${id}`,
      createdBy: userId,
      lines,
    });

    if (!journalEntry.id) {
      throw new InvalidStateError("Payroll journal entry was not created", {
        payrollRunId: id,
      });
    }

    return await this.payrollRepo.approve(id, {
      journalEntryId: journalEntry.id,
      approvedBy: userId,
      approvedAt: new Date(),
    });
  }

  executeSideEffectsPhase(_result: TEntity, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: TEntity): TEntity {
    return result;
  }

  private formatPeriod(year: number, month: number) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
}
