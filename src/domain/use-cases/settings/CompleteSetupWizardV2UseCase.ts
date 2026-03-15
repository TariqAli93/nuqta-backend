import type { ISystemSettingsRepository } from "../../interfaces/ISystemSettingsRepository.js";
import type { IPosSettingsRepository } from "../../interfaces/IPosSettingsRepository.js";
import type { UpdateSystemSettingsInput } from "../../entities/SystemSettings.js";
import type { UpdatePosSettingsInput } from "../../entities/PosSettings.js";
import type { SetupWizardSettings } from "../../entities/ModuleSettings.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";

/**
 * CompleteSetupWizardV2UseCase
 * Writes setup wizard results to the new structured settings tables
 * instead of the old KV store.
 */
export class CompleteSetupWizardV2UseCase {
  constructor(
    private systemSettingsRepo: ISystemSettingsRepository,
    private posSettingsRepo: IPosSettingsRepository,
  ) {}

  async execute(input: SetupWizardSettings): Promise<void> {
    if (!input.modules || !input.notifications || !input.invoice) {
      throw new ValidationError("Wizard settings are incomplete");
    }

    // Update system settings (modules + notifications)
    const systemUpdate: UpdateSystemSettingsInput = {
      accountingEnabled: input.modules.accountingEnabled,
      purchasesEnabled: input.modules.purchasesEnabled,
      ledgersEnabled: input.modules.ledgersEnabled,
      unitsEnabled: input.modules.unitsEnabled,
      paymentsOnInvoicesEnabled: input.modules.paymentsOnInvoicesEnabled,
      lowStockThreshold: input.notifications.lowStockThreshold,
      expiryAlertDays: input.notifications.expiryDays,
      debtReminderCount: input.notifications.debtReminderCount ?? 3,
      debtReminderIntervalDays:
        input.notifications.debtReminderIntervalDays ?? 7,
      setupWizardCompleted: true,
    };
    await this.systemSettingsRepo.update(systemUpdate);

    // Update POS/invoice settings
    const posUpdate: UpdatePosSettingsInput = {
      invoiceTemplateId: input.invoice.templateActiveId ?? "default",
      invoicePrefix: input.invoice.prefix,
      paperSize: input.invoice.paperSize,
      invoiceLogo: input.invoice.logo,
      invoiceFooterNotes: input.invoice.footerNotes,
      layoutDirection: input.invoice.layoutDirection ?? "rtl",
      showQr: input.invoice.showQr,
      showBarcode: input.invoice.showBarcode ?? false,
    };
    await this.posSettingsRepo.update(posUpdate);
  }
}
