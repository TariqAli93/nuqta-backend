import { PayrollRun, PayrollRunItem } from "../entities/Payroll.js";
import type { PayrollStatus } from "../shared/PayrollStateMachine.js";

export interface CreatePayrollRunRecord
  extends Omit<PayrollRun, "id" | "createdAt" | "approvedAt" | "approvedBy" | "items"> {
  items: Omit<PayrollRunItem, "id" | "payrollRunId" | "createdAt">[];
}

export interface IPayrollRepository {
  findAll(params?: {
    status?: PayrollStatus;
    periodYear?: number;
    periodMonth?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: PayrollRun[]; total: number }>;
  findById(id: number): Promise<PayrollRun | null>;
  existsForPeriod(periodYear: number, periodMonth: number): Promise<boolean>;
  create(run: CreatePayrollRunRecord): Promise<PayrollRun>;
  updateStatus(id: number, status: PayrollStatus): Promise<PayrollRun>;
  approve(
    id: number,
    input: {
      journalEntryId: number;
      approvedBy: number;
      approvedAt?: Date | string;
    },
  ): Promise<PayrollRun>;
}
