import { ISettingsRepository } from '../interfaces/ISettingsRepository.js';

export class GetSettingUseCase {
  constructor(private settingsRepo: ISettingsRepository) {}

  async execute(key: string) {
    return await this.settingsRepo.get(key);
  }
}
