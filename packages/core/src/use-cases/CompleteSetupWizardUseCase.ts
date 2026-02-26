import { ISettingsRepository } from '../interfaces/ISettingsRepository.js';
import {
  MODULE_SETTING_KEYS,
  NOTIFICATION_SETTING_KEYS,
  INVOICE_SETTING_KEYS,
  SETUP_SETTING_KEYS,
  type SetupWizardSettings,
} from '../entities/ModuleSettings.js';
import { ValidationError } from '../errors/DomainErrors.js';

/**
 * CompleteSetupWizardUseCase
 * Atomically writes all setup wizard settings to the KV store.
 * Called when the user finishes the 6-step wizard.
 */
export class CompleteSetupWizardUseCase {
  constructor(private settingsRepo: ISettingsRepository) {}

  execute(input: SetupWizardSettings): void {
    if (!input.modules || !input.notifications || !input.invoice) {
      throw new ValidationError('Wizard settings are incomplete');
    }

    const debtReminderCount = (input.notifications as any).debtReminderCount ?? 3;
    const debtReminderIntervalDays =
      (input.notifications as any).debtReminderIntervalDays ??
      (input.notifications as any).debtReminderInterval ??
      7;
    const templateActiveId = (input.invoice as any).templateActiveId ?? 'default';
    const layoutDirection = (input.invoice as any).layoutDirection ?? 'rtl';
    const showBarcode = Boolean((input.invoice as any).showBarcode ?? false);

    // Canonical module toggle keys
    this.settingsRepo.set(
      MODULE_SETTING_KEYS.ACCOUNTING_ENABLED,
      input.modules.accountingEnabled ? 'true' : 'false'
    );
    this.settingsRepo.set(
      MODULE_SETTING_KEYS.PURCHASES_ENABLED,
      input.modules.purchasesEnabled ? 'true' : 'false'
    );
    this.settingsRepo.set(
      MODULE_SETTING_KEYS.LEDGERS_ENABLED,
      input.modules.ledgersEnabled ? 'true' : 'false'
    );
    this.settingsRepo.set(
      MODULE_SETTING_KEYS.UNITS_ENABLED,
      input.modules.unitsEnabled ? 'true' : 'false'
    );
    this.settingsRepo.set(
      MODULE_SETTING_KEYS.PAYMENTS_ON_INVOICES_ENABLED,
      input.modules.paymentsOnInvoicesEnabled ? 'true' : 'false'
    );

    // Legacy module keys (backward compatibility for older consumers)
    this.settingsRepo.set(
      'modules.accounting.enabled',
      input.modules.accountingEnabled ? 'true' : 'false'
    );
    this.settingsRepo.set(
      'modules.purchases.enabled',
      input.modules.purchasesEnabled ? 'true' : 'false'
    );
    this.settingsRepo.set('modules.ledgers.enabled', input.modules.ledgersEnabled ? 'true' : 'false');
    this.settingsRepo.set('modules.units.enabled', input.modules.unitsEnabled ? 'true' : 'false');
    this.settingsRepo.set(
      'modules.payments_on_invoices.enabled',
      input.modules.paymentsOnInvoicesEnabled ? 'true' : 'false'
    );

    // Canonical notification keys
    this.settingsRepo.set(
      NOTIFICATION_SETTING_KEYS.LOW_STOCK_THRESHOLD,
      String(input.notifications.lowStockThreshold)
    );
    this.settingsRepo.set(
      NOTIFICATION_SETTING_KEYS.EXPIRY_DAYS,
      String(input.notifications.expiryDays)
    );
    this.settingsRepo.set(NOTIFICATION_SETTING_KEYS.DEBT_REMINDER_COUNT, String(debtReminderCount));
    this.settingsRepo.set(
      NOTIFICATION_SETTING_KEYS.DEBT_REMINDER_INTERVAL_DAYS,
      String(debtReminderIntervalDays)
    );

    // Legacy notification keys
    this.settingsRepo.set(
      'notifications.low_stock_threshold',
      String(input.notifications.lowStockThreshold)
    );
    this.settingsRepo.set('notifications.expiry_days', String(input.notifications.expiryDays));
    this.settingsRepo.set('notifications.debt_reminder_interval', String(debtReminderIntervalDays));

    // Canonical invoice keys
    this.settingsRepo.set(INVOICE_SETTING_KEYS.TEMPLATE_ACTIVE_ID, templateActiveId);
    this.settingsRepo.set(INVOICE_SETTING_KEYS.PREFIX, input.invoice.prefix);
    this.settingsRepo.set(INVOICE_SETTING_KEYS.PAPER_SIZE, input.invoice.paperSize);
    this.settingsRepo.set(INVOICE_SETTING_KEYS.LOGO, input.invoice.logo);
    this.settingsRepo.set(INVOICE_SETTING_KEYS.FOOTER_NOTES, input.invoice.footerNotes);
    this.settingsRepo.set(INVOICE_SETTING_KEYS.LAYOUT_DIRECTION, layoutDirection);
    this.settingsRepo.set(INVOICE_SETTING_KEYS.SHOW_QR, input.invoice.showQr ? 'true' : 'false');
    this.settingsRepo.set(INVOICE_SETTING_KEYS.SHOW_BARCODE, showBarcode ? 'true' : 'false');

    // Legacy invoice keys
    this.settingsRepo.set('invoice.prefix', input.invoice.prefix);
    this.settingsRepo.set('invoice.paper_size', input.invoice.paperSize);
    this.settingsRepo.set('invoice.footer_notes', input.invoice.footerNotes);
    this.settingsRepo.set('invoice.show_qr', input.invoice.showQr ? 'true' : 'false');

    // Mark wizard as completed
    this.settingsRepo.set(SETUP_SETTING_KEYS.WIZARD_COMPLETED, 'true');
    this.settingsRepo.set('setup.wizard_completed', 'true');
  }
}
