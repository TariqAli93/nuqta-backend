import { IEmployeeRepository } from "../../interfaces/IEmployeeRepository.js";

export class GetEmployeesUseCase {
  constructor(private employeeRepo: IEmployeeRepository) {}

  async execute(params?: {
    search?: string;
    department?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return await this.employeeRepo.findAll(params);
  }
}
