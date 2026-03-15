import type { IBarcodeSettingsRepository } from "../../interfaces/IBarcodeSettingsRepository.js";
import type {
  BarcodeSettingsEntity,
  UpdateBarcodeSettingsInput,
} from "../../entities/BarcodeSettings.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export class UpdateBarcodeSettingsUseCase extends WriteUseCase<UpdateBarcodeSettingsInput, BarcodeSettingsEntity, BarcodeSettingsEntity> {
  constructor(private repo: IBarcodeSettingsRepository) {
    super();
  }

  async executeCommitPhase(
    input: UpdateBarcodeSettingsInput,
    _userId: string,
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

  executeSideEffectsPhase(_result: BarcodeSettingsEntity, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: BarcodeSettingsEntity): BarcodeSettingsEntity {
    return result;
  }
}
