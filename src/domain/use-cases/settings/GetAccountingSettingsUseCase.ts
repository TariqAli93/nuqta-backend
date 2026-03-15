// any key start with accounting will be considered as accounting setting
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";

export class GetAccountingSettingsUseCase {
  constructor(private settingsRepo: ISettingsRepository) {}

  async execute() {
    const allSettings = await this.settingsRepo.getAll();
    const accountingSettings = Object.fromEntries(
      Object.entries(allSettings).filter(([key]) =>
        key.startsWith("accounting"),
      ),
    );
    return accountingSettings;
  }
}
