import type { IBarcodeSettingsRepository } from "../../interfaces/IBarcodeSettingsRepository.js";
import type { BarcodeSettingsEntity } from "../../entities/BarcodeSettings.js";

export class GetBarcodeSettingsUseCase {
  constructor(private repo: IBarcodeSettingsRepository) {}

  async execute(): Promise<BarcodeSettingsEntity> {
    return this.repo.get();
  }
}
