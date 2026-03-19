import { Department } from "../entities/Department.js";

export interface IDepartmentRepository {
  findAll(params?: {
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Department[]; total: number }>;
  findById(id: number): Promise<Department | null>;
  create(department: Department): Promise<Department>;
  update(id: number, department: Partial<Department>): Promise<Department>;
}
