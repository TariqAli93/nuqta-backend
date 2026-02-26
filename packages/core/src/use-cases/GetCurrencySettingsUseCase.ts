import { ISettingsRepository } from '../interfaces/ISettingsRepository.js';

export class GetCurrencySettingsUseCase {
  constructor(private settingsRepo: ISettingsRepository) {}

  async execute() {
    return await this.settingsRepo.getCurrencySettings();
  }
}
