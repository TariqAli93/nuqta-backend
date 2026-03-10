import type { IPosSettingsRepository } from "../../interfaces/IPosSettingsRepository.js";
import type {
  PosSettingsEntity,
  UpdatePosSettingsInput,
} from "../../entities/PosSettings.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";

export class UpdatePosSettingsUseCase {
  constructor(private repo: IPosSettingsRepository) {}

  async execute(input: UpdatePosSettingsInput): Promise<PosSettingsEntity> {
    if (
      input.invoicePrefix !== undefined &&
      input.invoicePrefix.trim().length === 0
    ) {
      throw new ValidationError("Invoice prefix cannot be empty");
    }

    if (
      input.paperSize !== undefined &&
      !["thermal", "a4", "a5"].includes(input.paperSize)
    ) {
      throw new ValidationError("Paper size must be thermal, a4, or a5");
    }

    if (
      input.layoutDirection !== undefined &&
      !["rtl", "ltr"].includes(input.layoutDirection)
    ) {
      throw new ValidationError("Layout direction must be rtl or ltr");
    }

    return this.repo.update(input);
  }
}
