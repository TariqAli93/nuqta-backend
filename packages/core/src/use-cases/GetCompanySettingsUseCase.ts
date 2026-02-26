import { ISettingsRepository } from '../interfaces/ISettingsRepository.js';
import type { CompanySettings } from '../entities/Settings.js';

export class GetCompanySettingsUseCase {
  constructor(private settingsRepo: ISettingsRepository) {}

  async execute(): Promise<CompanySettings | null> {
    return await this.settingsRepo.getCompanySettings();
  }
}
