import type { ISystemSettingsRepository } from "../../interfaces/ISystemSettingsRepository.js";
import type { SystemSettings } from "../../entities/SystemSettings.js";

export class GetSystemSettingsUseCase {
  constructor(private repo: ISystemSettingsRepository) {}

  async execute(): Promise<SystemSettings> {
    return this.repo.get();
  }
}
