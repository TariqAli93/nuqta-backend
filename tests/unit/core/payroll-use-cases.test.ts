import { describe, expect, test, vi } from "vitest";
import { CreatePayrollRunUseCase } from "../../../src/domain/use-cases/hr/CreatePayrollRunUseCase.ts";
import { ApprovePayrollRunUseCase } from "../../../src/domain/use-cases/hr/ApprovePayrollRunUseCase.ts";
import {
  ACCOUNTING_SETTING_KEYS,
} from "../../../src/domain/use-cases/accounting/InitializeAccountingUseCase.ts";

describe("payroll use cases", () => {
  test("CreatePayrollRunUseCase calculates monthly totals from salary, deductions, and bonuses", async () => {
    const employeeRepo = {
      findByIds: vi.fn(async () => [
        {
          id: 13,
          name: "Sara Ali",
          salary: 1500000,
          position: "Accountant",
          department: "Finance",
          isActive: true,
        },
      ]),
    };
    const payrollRepo = {
      existsForPeriod: vi.fn(async () => false),
      create: vi.fn(async (run) => ({
        id: 101,
        createdAt: "2026-03-01T10:00:00.000Z",
        ...run,
      })),
    };
    const settingsRepo = {
      get: vi.fn(async (key: string) => {
        if (key === ACCOUNTING_SETTING_KEYS.salaryExpenseAccountCode) {
          return "5100";
        }
        if (key === ACCOUNTING_SETTING_KEYS.deductionsLiabilityAccountCode) {
          return "2101";
        }
        if (key === ACCOUNTING_SETTING_KEYS.cashAccountCode) {
          return "1001";
        }
        return null;
      }),
    };

    const uc = new CreatePayrollRunUseCase(
      employeeRepo as any,
      payrollRepo as any,
      settingsRepo as any,
    );

    const result = await uc.execute(
      {
        periodYear: 2026,
        periodMonth: 3,
        paymentDate: "2026-03-31",
        items: [
          {
            employeeId: 13,
            deductions: 50000,
            bonuses: 100000,
            notes: "Overtime",
          },
        ],
      },
      7,
    );

    expect(payrollRepo.existsForPeriod).toHaveBeenCalledWith(2026, 3);
    expect(payrollRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        periodYear: 2026,
        periodMonth: 3,
        totalGrossPay: 1500000,
        totalDeductions: 50000,
        totalBonuses: 100000,
        totalNetPay: 1550000,
        salaryExpenseAccountCode: "5100",
        deductionsLiabilityAccountCode: "2101",
        paymentAccountCode: "1001",
        createdBy: 7,
      }),
    );
    expect(result.totalNetPay).toBe(1550000);
    expect(result.items[0]).toMatchObject({
      employeeId: 13,
      grossPay: 1500000,
      deductions: 50000,
      bonuses: 100000,
      netPay: 1550000,
    });
  });

  test("ApprovePayrollRunUseCase creates a manual journal entry and stores the journal id", async () => {
    const payrollRun = {
      id: 101,
      periodYear: 2026,
      periodMonth: 3,
      paymentDate: "2026-03-31T00:00:00.000Z",
      status: "draft" as const,
      totalGrossPay: 1500000,
      totalDeductions: 50000,
      totalBonuses: 100000,
      totalNetPay: 1550000,
      salaryExpenseAccountCode: "5002",
      deductionsLiabilityAccountCode: "2101",
      paymentAccountCode: "1001",
      journalEntryId: null,
      notes: "March payroll",
      createdAt: "2026-03-01T10:00:00.000Z",
      createdBy: 1,
      approvedAt: null,
      approvedBy: null,
      items: [
        {
          employeeId: 13,
          employeeName: "Sara Ali",
          position: "Accountant",
          department: "Finance",
          grossPay: 1500000,
          deductions: 50000,
          bonuses: 100000,
          netPay: 1550000,
        },
      ],
    };
    const payrollRepo = {
      findById: vi.fn(async () => payrollRun),
      approve: vi.fn(async (id: number, input: any) => ({
        ...payrollRun,
        id,
        status: "approved",
        journalEntryId: input.journalEntryId,
        approvedBy: input.approvedBy,
        approvedAt: input.approvedAt,
      })),
    };
    const accountingRepo = {
      findAccountByCode: vi.fn(async (code: string) => {
        if (code === "5002") return { id: 501, code };
        if (code === "2101") return { id: 211, code };
        if (code === "1001") return { id: 101, code };
        return null;
      }),
      createJournalEntrySync: vi.fn(async (entry: any) => ({
        id: 81,
        ...entry,
      })),
    };

    const uc = new ApprovePayrollRunUseCase(
      payrollRepo as any,
      accountingRepo as any,
    );

    const result = await uc.execute(101, 99);

    expect(accountingRepo.createJournalEntrySync).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "manual",
        sourceId: 101,
        totalAmount: 1600000,
        createdBy: 99,
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountId: 501,
            debit: 1600000,
            credit: 0,
          }),
          expect.objectContaining({
            accountId: 211,
            debit: 0,
            credit: 50000,
          }),
          expect.objectContaining({
            accountId: 101,
            debit: 0,
            credit: 1550000,
          }),
        ]),
      }),
    );
    expect(payrollRepo.approve).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        journalEntryId: 81,
        approvedBy: 99,
      }),
    );
    expect(result.status).toBe("approved");
    expect(result.journalEntryId).toBe(81);
  });
});
