import { ISettingsRepository } from '../interfaces/ISettingsRepository.js';
import type { CompanySettings } from '../entities/Settings.js';
import { ValidationError } from '../errors/DomainErrors.js';

export class SetCompanySettingsUseCase {
  constructor(private settingsRepo: ISettingsRepository) {}

  async execute(settings: CompanySettings): Promise<void> {
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
}
