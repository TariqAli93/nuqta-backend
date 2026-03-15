import type {
  PosSettingsEntity,
  UpdatePosSettingsInput,
} from "../entities/PosSettings.js";

export interface IPosSettingsRepository {
  /** Get the singleton POS settings row (creates default if missing) */
  get(): Promise<PosSettingsEntity>;

  /** Partially update POS settings */
  update(input: UpdatePosSettingsInput): Promise<PosSettingsEntity>;
}
