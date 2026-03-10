import { z } from "zod";

export const PayrollRunItemSchema = z.object({
  id: z.number().optional(),
  payrollRunId: z.number().optional(),
  employeeId: z.number().int().min(1),
  employeeName: z.string().min(1),
  position: z.string().min(1),
  department: z.string().min(1),
  grossPay: z.number().int().min(0),
  deductions: z.number().int().min(0).default(0),
  bonuses: z.number().int().min(0).default(0),
  netPay: z.number().int().min(0),
  notes: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const PayrollRunSchema = z.object({
  id: z.number().optional(),
  periodYear: z.number().int().min(2000).max(9999),
  periodMonth: z.number().int().min(1).max(12),
  paymentDate: z.union([z.string(), z.date()]).nullable().optional(),
  status: z.enum(["draft", "approved"]).default("draft"),
  totalGrossPay: z.number().int().min(0),
  totalDeductions: z.number().int().min(0).default(0),
  totalBonuses: z.number().int().min(0).default(0),
  totalNetPay: z.number().int().min(0),
  salaryExpenseAccountCode: z.string().min(1),
  deductionsLiabilityAccountCode: z.string().min(1),
  paymentAccountCode: z.string().min(1),
  journalEntryId: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  createdBy: z.number().optional(),
  approvedAt: z.union([z.string(), z.date()]).nullable().optional(),
  approvedBy: z.number().nullable().optional(),
  items: z.array(PayrollRunItemSchema).optional(),
});

export type PayrollRunItem = z.infer<typeof PayrollRunItemSchema>;
export type PayrollRun = z.infer<typeof PayrollRunSchema>;
