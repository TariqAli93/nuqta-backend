import type {
  SystemSettings,
  UpdateSystemSettingsInput,
} from "../entities/SystemSettings.js";

export interface ISystemSettingsRepository {
  /** Get the singleton system settings row (creates default if missing) */
  get(): Promise<SystemSettings>;

  /** Partially update system settings */
  update(input: UpdateSystemSettingsInput): Promise<SystemSettings>;
}
