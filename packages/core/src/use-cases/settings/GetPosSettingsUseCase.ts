import type { IPosSettingsRepository } from "../../interfaces/IPosSettingsRepository.js";
import type { PosSettingsEntity } from "../../entities/PosSettings.js";

export class GetPosSettingsUseCase {
  constructor(private repo: IPosSettingsRepository) {}

  async execute(): Promise<PosSettingsEntity> {
    return this.repo.get();
  }
}
