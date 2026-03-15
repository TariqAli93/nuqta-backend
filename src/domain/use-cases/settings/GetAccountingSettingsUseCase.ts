// any key start with accounting will be considered as accounting setting
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetAccountingSettingsUseCase extends ReadUseCase<void, Record<string, string>> {
  constructor(private settingsRepo: ISettingsRepository) {
    super();
  }

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
