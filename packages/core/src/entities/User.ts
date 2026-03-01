import { z } from "zod";

export const UserSchema = z.object({
  id: z.number().optional(),
  username: z.string().min(1),
  password: z.string().min(1), // Hashed
  fullName: z.string(),
  phone: z.string().nullable().optional(),
  role: z.enum(["admin", "cashier", "manager", "viewer"]).default("cashier"),
  isActive: z.boolean().default(true),
  lastLoginAt: z.union([z.string(), z.date()]).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export type User = z.infer<typeof UserSchema>;
