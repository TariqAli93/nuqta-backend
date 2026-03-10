import { Employee } from "../entities/Employee.js";

export interface IEmployeeRepository {
  findAll(params?: {
    search?: string;
    department?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Employee[]; total: number }>;
  findById(id: number): Promise<Employee | null>;
  findByIds(ids: number[]): Promise<Employee[]>;
  create(employee: Employee): Promise<Employee>;
  update(id: number, employee: Partial<Employee>): Promise<Employee>;
}
