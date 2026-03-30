import { z } from "zod";

export const EmployeeSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  salary: z.number().int().min(0),
  position: z.string().min(1),
  departmentId: z.number().int().min(1),
  departmentName: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  createdBy: z.number().optional(),
});

export type Employee = z.infer<typeof EmployeeSchema>;
