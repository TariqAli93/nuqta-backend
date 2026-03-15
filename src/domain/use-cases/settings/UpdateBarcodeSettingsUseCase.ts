import type { IBarcodeSettingsRepository } from "../../interfaces/IBarcodeSettingsRepository.js";
import type {
  BarcodeSettingsEntity,
  UpdateBarcodeSettingsInput,
} from "../../entities/BarcodeSettings.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";

export class UpdateBarcodeSettingsUseCase {
  constructor(private repo: IBarcodeSettingsRepository) {}

  async execute(
    input: UpdateBarcodeSettingsInput,
  ): Promise<BarcodeSettingsEntity> {
    if (input.defaultWidth !== undefined && input.defaultWidth < 1) {
      throw new ValidationError("Barcode width must be at least 1");
    }

    if (input.defaultHeight !== undefined && input.defaultHeight < 1) {
      throw new ValidationError("Barcode height must be at least 1");
    }

    if (input.printDpi !== undefined && input.printDpi < 72) {
      throw new ValidationError("Print DPI must be at least 72");
    }

    if (input.labelWidthMm !== undefined && input.labelWidthMm < 1) {
      throw new ValidationError("Label width must be at least 1mm");
    }

    if (input.labelHeightMm !== undefined && input.labelHeightMm < 1) {
      throw new ValidationError("Label height must be at least 1mm");
    }

    return this.repo.update(input);
  }
}
