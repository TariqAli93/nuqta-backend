import type { IAccountingSettingsRepository } from "../../interfaces/IAccountingSettingsRepository.js";
import type {
  AccountingSettingsEntity,
  UpdateAccountingSettingsInput,
} from "../../entities/AccountingSettings.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";

export class UpdateAccountingSettingsUseCase {
  constructor(private repo: IAccountingSettingsRepository) {}

  async execute(
    input: UpdateAccountingSettingsInput,
  ): Promise<AccountingSettingsEntity> {
    if (
      input.defaultTaxRate !== undefined &&
      (input.defaultTaxRate < 0 || input.defaultTaxRate > 100)
    ) {
      throw new ValidationError("Tax rate must be between 0 and 100");
    }

    if (input.currencyCode !== undefined && input.currencyCode.length !== 3) {
      throw new ValidationError("Currency code must be a 3-letter ISO code");
    }

    if (input.usdExchangeRate !== undefined && input.usdExchangeRate < 0) {
      throw new ValidationError("Exchange rate must be non-negative");
    }

    if (
      input.fiscalYearStartMonth !== undefined &&
      (input.fiscalYearStartMonth < 1 || input.fiscalYearStartMonth > 12)
    ) {
      throw new ValidationError(
        "Fiscal year start month must be between 1 and 12",
      );
    }

    if (
      input.fiscalYearStartDay !== undefined &&
      (input.fiscalYearStartDay < 1 || input.fiscalYearStartDay > 31)
    ) {
      throw new ValidationError(
        "Fiscal year start day must be between 1 and 31",
      );
    }

    return this.repo.update(input);
  }
}
