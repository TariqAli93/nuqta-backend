import type { ISystemSettingsRepository } from "../../interfaces/ISystemSettingsRepository.js";
import type {
  SystemSettings,
  UpdateSystemSettingsInput,
} from "../../entities/SystemSettings.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";

export class UpdateSystemSettingsUseCase {
  constructor(private repo: ISystemSettingsRepository) {}

  async execute(input: UpdateSystemSettingsInput): Promise<SystemSettings> {
    if (
      input.companyName !== undefined &&
      input.companyName.trim().length === 0
    ) {
      throw new ValidationError("Company name cannot be empty");
    }

    if (
      input.defaultCurrency !== undefined &&
      input.defaultCurrency.length !== 3
    ) {
      throw new ValidationError("Currency must be a 3-letter ISO code");
    }

    if (input.lowStockThreshold !== undefined && input.lowStockThreshold < 0) {
      throw new ValidationError("Low stock threshold must be non-negative");
    }

    if (input.expiryAlertDays !== undefined && input.expiryAlertDays < 0) {
      throw new ValidationError("Expiry alert days must be non-negative");
    }

    if (input.debtReminderCount !== undefined && input.debtReminderCount < 0) {
      throw new ValidationError("Debt reminder count must be non-negative");
    }

    if (
      input.debtReminderIntervalDays !== undefined &&
      input.debtReminderIntervalDays < 0
    ) {
      throw new ValidationError("Debt reminder interval must be non-negative");
    }

    return this.repo.update(input);
  }
}
