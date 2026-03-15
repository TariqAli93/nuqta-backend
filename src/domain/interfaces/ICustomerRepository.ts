import { Customer } from "../entities/Customer.js";

export interface ICustomerRepository {
  findAll(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Customer[]; total: number }>;
  findById(id: number): Promise<Customer | null>;
  create(customer: Customer): Promise<Customer>;
  update(id: number, customer: Partial<Customer>): Promise<Customer>;
  delete(id: number): Promise<void>;
  updateDebt(id: number, amountChange: number): Promise<void>;
}
