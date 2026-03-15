import type {
  BarcodeSettingsEntity,
  UpdateBarcodeSettingsInput,
} from "../entities/BarcodeSettings.js";

export interface IBarcodeSettingsRepository {
  /** Get the singleton barcode settings row (creates default if missing) */
  get(): Promise<BarcodeSettingsEntity>;

  /** Partially update barcode settings */
  update(input: UpdateBarcodeSettingsInput): Promise<BarcodeSettingsEntity>;
}
