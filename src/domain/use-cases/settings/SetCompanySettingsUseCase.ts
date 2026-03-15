import { ISettingsRepository } from '../../interfaces/ISettingsRepository.js';
import type { CompanySettings } from '../../entities/Settings.js';
import { ValidationError } from '../../shared/errors/DomainErrors.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export class SetCompanySettingsUseCase extends WriteUseCase<CompanySettings, void, void> {
  constructor(private settingsRepo: ISettingsRepository) {
    super();
  }

  async executeCommitPhase(settings: CompanySettings, _userId: string): Promise<void> {
    if (!settings.name || settings.name.trim().length === 0) {
      throw new ValidationError('Company name is required');
    }

    if (settings.currency && settings.currency.length !== 3) {
      throw new ValidationError('Currency must be a 3-letter ISO code');
    }

    if (settings.lowStockThreshold < 0) {
      throw new ValidationError('Low stock threshold must be non-negative');
    }

    await this.settingsRepo.setCompanySettings(settings);
  }

  executeSideEffectsPhase(_r: void, _u: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: void): void {
    return result;
  }
}
