import { Employee } from "../../entities/Employee.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/DomainErrors.js";
import { IEmployeeRepository } from "../../interfaces/IEmployeeRepository.js";
import {
  CreatePayrollRunRecord,
  IPayrollRepository,
} from "../../interfaces/IPayrollRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import {
  ACCOUNTING_SETTING_KEYS,
  DEFAULT_ACCOUNTING_CODES,
} from "../accounting/InitializeAccountingUseCase.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export interface CreatePayrollRunInput {
  periodYear: number;
  periodMonth: number;
  paymentDate?: string;
  salaryExpenseAccountCode?: string;
  deductionsLiabilityAccountCode?: string;
  paymentAccountCode?: string;
  notes?: string;
  items: {
    employeeId: number;
    deductions?: number;
    bonuses?: number;
    notes?: string;
  }[];
}

type TEntity = Awaited<ReturnType<IPayrollRepository["create"]>>;

export class CreatePayrollRunUseCase extends WriteUseCase<CreatePayrollRunInput, TEntity, TEntity> {
  constructor(
    private employeeRepo: IEmployeeRepository,
    private payrollRepo: IPayrollRepository,
    private settingsRepo?: ISettingsRepository,
  ) {
    super();
  }

  async executeCommitPhase(input: CreatePayrollRunInput, _userId: string): Promise<TEntity> {
    this.validateInput(input);

    if (
      await this.payrollRepo.existsForPeriod(input.periodYear, input.periodMonth)
    ) {
      throw new ConflictError("Payroll run already exists for this period", {
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
      });
    }

    const employeeIds = input.items.map((item) => item.employeeId);
    const employees = await this.employeeRepo.findByIds(employeeIds);
    if (employees.length !== employeeIds.length) {
      const foundIds = new Set(employees.map((employee) => employee.id));
      const missingId = employeeIds.find((employeeId) => !foundIds.has(employeeId));
      throw new NotFoundError("Employee not found for payroll run", {
        employeeId: missingId,
      });
    }

    const employeesById = new Map(
      employees.map((employee) => [employee.id as number, employee]),
    );
    const items = input.items.map((item) => {
      const employee = employeesById.get(item.employeeId);
      if (!employee) {
        throw new NotFoundError("Employee not found for payroll run", {
          employeeId: item.employeeId,
        });
      }
      return this.buildLine(employee, item);
    });

    const totalGrossPay = items.reduce((sum, item) => sum + item.grossPay, 0);
    const totalDeductions = items.reduce(
      (sum, item) => sum + item.deductions,
      0,
    );
    const totalBonuses = items.reduce((sum, item) => sum + item.bonuses, 0);
    const totalNetPay = items.reduce((sum, item) => sum + item.netPay, 0);

    const run: CreatePayrollRunRecord = {
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : null,
      status: "draft",
      totalGrossPay,
      totalDeductions,
      totalBonuses,
      totalNetPay,
      salaryExpenseAccountCode: await this.resolveSalaryExpenseAccountCode(
        input.salaryExpenseAccountCode,
      ),
      deductionsLiabilityAccountCode:
        await this.resolveDeductionsLiabilityAccountCode(
          input.deductionsLiabilityAccountCode,
        ),
      paymentAccountCode: await this.resolvePaymentAccountCode(
        input.paymentAccountCode,
      ),
      journalEntryId: null,
      notes: input.notes,
      createdBy: Number(_userId) || 0,
      items,
    };

    return await this.payrollRepo.create(run);
  }

  executeSideEffectsPhase(_result: TEntity, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: TEntity): TEntity {
    return result;
  }

  private validateInput(input: CreatePayrollRunInput) {
    if (!Number.isInteger(input.periodYear) || input.periodYear < 2000) {
      throw new ValidationError("Payroll period year must be a valid integer", {
        periodYear: input.periodYear,
      });
    }
    if (
      !Number.isInteger(input.periodMonth) ||
      input.periodMonth < 1 ||
      input.periodMonth > 12
    ) {
      throw new ValidationError("Payroll period month must be between 1 and 12", {
        periodMonth: input.periodMonth,
      });
    }
    if (!input.items || input.items.length === 0) {
      throw new ValidationError("Payroll run must include at least one employee");
    }

    const seen = new Set<number>();
    for (const item of input.items) {
      if (!Number.isInteger(item.employeeId) || item.employeeId <= 0) {
        throw new ValidationError("Payroll employeeId must be a positive integer", {
          employeeId: item.employeeId,
        });
      }
      if (seen.has(item.employeeId)) {
        throw new ValidationError("Duplicate employee in payroll run", {
          employeeId: item.employeeId,
        });
      }
      seen.add(item.employeeId);

      if (
        item.deductions !== undefined &&
        (!Number.isInteger(item.deductions) || item.deductions < 0)
      ) {
        throw new ValidationError("Payroll deductions must be a non-negative integer", {
          employeeId: item.employeeId,
          deductions: item.deductions,
        });
      }

      if (
        item.bonuses !== undefined &&
        (!Number.isInteger(item.bonuses) || item.bonuses < 0)
      ) {
        throw new ValidationError("Payroll bonuses must be a non-negative integer", {
          employeeId: item.employeeId,
          bonuses: item.bonuses,
        });
      }
    }
  }

  private buildLine(
    employee: Employee,
    item: CreatePayrollRunInput["items"][number],
  ): CreatePayrollRunRecord["items"][number] {
    if (!employee.id) {
      throw new NotFoundError("Employee not found for payroll run");
    }
    if (!Number.isInteger(employee.salary) || employee.salary < 0) {
      throw new ValidationError("Employee salary must be a non-negative integer", {
        employeeId: employee.id,
        salary: employee.salary,
      });
    }

    const deductions = item.deductions || 0;
    const bonuses = item.bonuses || 0;
    const netPay = employee.salary - deductions + bonuses;

    if (netPay < 0) {
      throw new ValidationError("Payroll net pay cannot be negative", {
        employeeId: employee.id,
        salary: employee.salary,
        deductions,
        bonuses,
      });
    }

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      position: employee.position,
      departmentName: employee.departmentName || "",
      grossPay: employee.salary,
      deductions,
      bonuses,
      netPay,
      notes: item.notes,
    };
  }

  private async resolveSalaryExpenseAccountCode(inputCode?: string) {
    const direct = inputCode?.trim();
    if (direct) return direct;
    const fromSettings = await this.settingsRepo?.get(
      ACCOUNTING_SETTING_KEYS.salaryExpenseAccountCode,
    );
    return (
      fromSettings?.trim() || DEFAULT_ACCOUNTING_CODES.salaryExpenseAccountCode
    );
  }

  private async resolvePaymentAccountCode(inputCode?: string) {
    const direct = inputCode?.trim();
    if (direct) return direct;
    const fromSettings = await this.settingsRepo?.get(
      ACCOUNTING_SETTING_KEYS.cashAccountCode,
    );
    return fromSettings?.trim() || DEFAULT_ACCOUNTING_CODES.cashAccountCode;
  }

  private async resolveDeductionsLiabilityAccountCode(inputCode?: string) {
    const direct = inputCode?.trim();
    if (direct) return direct;
    const fromSettings = await this.settingsRepo?.get(
      ACCOUNTING_SETTING_KEYS.deductionsLiabilityAccountCode,
    );
    return (
      fromSettings?.trim() ||
      DEFAULT_ACCOUNTING_CODES.deductionsLiabilityAccountCode
    );
  }
}
