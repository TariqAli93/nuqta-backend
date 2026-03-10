import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";

export class SetSettingUseCase {
  constructor(private settingsRepo: ISettingsRepository) {}

  async execute(body: { key: string; value: string }) {
    const { key, value } = body;
    return await this.settingsRepo.set(key, value);
  }
}
