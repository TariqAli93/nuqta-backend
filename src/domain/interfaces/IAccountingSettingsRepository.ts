import type {
  AccountingSettingsEntity,
  UpdateAccountingSettingsInput,
} from "../entities/AccountingSettings.js";

export interface IAccountingSettingsRepository {
  /** Get the singleton accounting settings row (creates default if missing) */
  get(): Promise<AccountingSettingsEntity>;

  /** Partially update accounting settings */
  update(
    input: UpdateAccountingSettingsInput,
  ): Promise<AccountingSettingsEntity>;
}
