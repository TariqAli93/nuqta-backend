import type { IAccountingSettingsRepository } from "../../interfaces/IAccountingSettingsRepository.js";
import type { AccountingSettingsEntity } from "../../entities/AccountingSettings.js";

export class GetAccountingSettingsV2UseCase {
  constructor(private repo: IAccountingSettingsRepository) {}

  async execute(): Promise<AccountingSettingsEntity> {
    return this.repo.get();
  }
}
