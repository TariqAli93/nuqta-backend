import { ISettingsRepository } from '../interfaces/ISettingsRepository.js';

export class SetSettingUseCase {
  constructor(private settingsRepo: ISettingsRepository) {}

  async execute(key: string, value: string) {
    return await this.settingsRepo.set(key, value);
  }
}
