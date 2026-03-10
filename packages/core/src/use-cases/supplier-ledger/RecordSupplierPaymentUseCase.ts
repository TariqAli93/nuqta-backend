import { ISupplierLedgerRepository } from "../../interfaces/ISupplierLedgerRepository.js";
import { ISupplierRepository } from "../../interfaces/ISupplierRepository.js";
import { IPaymentRepository } from "../../interfaces/IPaymentRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError, ValidationError } from "../../shared/errors/DomainErrors.js";
import { SupplierLedgerEntry } from "../../entities/Ledger.js";
import { AuditService } from "../../shared/services/AuditService.js";
import { SettingsAccessor } from "../../shared/services/SettingsAccessor.js";

export interface RecordSupplierPaymentInput {
  supplierId: number;
  amount: number;
  paymentMethod: string;
  notes?: string;
  idempotencyKey?: string;
}

export class RecordSupplierPaymentUseCase {
  private auditService?: AuditService;

  constructor(
    private ledgerRepo: ISupplierLedgerRepository,
    private supplierRepo: ISupplierRepository,
    private paymentRepo: IPaymentRepository,
    private accountingRepo: IAccountingRepository,
    auditRepo?: IAuditRepository,
    private settingsRepo?: ISettingsRepository,
  ) {
    if (auditRepo) {
      this.auditService = new AuditService(auditRepo);
    }
  }

  async executeCommitPhase(
    data: RecordSupplierPaymentInput,
    userId: number,
  ): Promise<SupplierLedgerEntry> {
    if (data.amount <= 0) {
      throw new ValidationError("Payment amount must be greater than zero");
    }
    if (!Number.isInteger(data.amount)) {
      throw new ValidationError("Payment amount must be an integer IQD amount");
    }

    const supplier = await this.supplierRepo.findByIdSync(data.supplierId);
    if (!supplier) {
      throw new NotFoundError("Supplier not found");
    }

    if (data.idempotencyKey) {
      const existingPayment = await this.paymentRepo.findByIdempotencyKey(
        data.idempotencyKey,
      );
      if (existingPayment?.id) {
        const existingEntry = await this.ledgerRepo.findByPaymentIdSync(
          existingPayment.id,
        );
        if (existingEntry) return existingEntry;
      }
    }

    const payment = await this.paymentRepo.createSync({
      supplierId: data.supplierId,
      amount: data.amount,
      currency: "IQD",
      exchangeRate: 1,
      paymentMethod: data.paymentMethod as any,
      idempotencyKey: data.idempotencyKey,
      status: "completed",
      notes: data.notes,
      paymentDate: new Date(),
      createdAt: new Date(),
      createdBy: userId,
    } as any);

    const balanceBefore = await this.ledgerRepo.getLastBalanceSync(
      data.supplierId,
    );
    const balanceAfter = balanceBefore - data.amount;

    const entry = await this.ledgerRepo.createSync({
      supplierId: data.supplierId,
      transactionType: "payment",
      amount: -data.amount,
      balanceAfter,
      paymentId: payment.id,
      notes: data.notes,
      createdBy: userId,
    });

    // Update cached currentBalance on supplier record
    await this.supplierRepo.updatePayable(data.supplierId, balanceAfter);

    // Create journal entry only if accounting is enabled
    if (await this.isAccountingEnabled()) {
      await this.createJournalEntry(payment.id!, data.amount, userId);
    }

    return entry;
  }

  private async isAccountingEnabled(): Promise<boolean> {
    if (!this.settingsRepo) return true;
    const settings = new SettingsAccessor(this.settingsRepo);
    return settings.isAccountingEnabled();
  }

  private async createJournalEntry(
    paymentId: number,
    amount: number,
    userId: number,
  ): Promise<void> {
    // Resolve account codes from settings
    const settings = this.settingsRepo
      ? new SettingsAccessor(this.settingsRepo)
      : null;
    const cashCode = settings ? await settings.getCashAccountCode() : "1001";
    const apCode = settings ? await settings.getApAccountCode() : "2100";

    const cashAcct = await this.accountingRepo.findAccountByCode(cashCode);
    const apAcct = await this.accountingRepo.findAccountByCode(apCode);

    if (!cashAcct?.id || !apAcct?.id) {
      console.warn(
        "[RecordSupplierPaymentUseCase] Missing cash/AP accounts, skipping journal",
      );
      return;
    }

    await this.accountingRepo.createJournalEntrySync({
      entryNumber: `JE-SPAY-${paymentId}`,
      entryDate: new Date(),
      description: `Supplier payment #${paymentId}`,
      sourceType: "payment",
      sourceId: paymentId,
      isPosted: false,
      isReversed: false,
      totalAmount: amount,
      currency: "IQD",
      createdBy: userId,
      lines: [
        {
          accountId: apAcct.id,
          debit: amount,
          credit: 0,
          description: "AP settled",
        },
        {
          accountId: cashAcct.id,
          debit: 0,
          credit: amount,
          description: "Cash paid",
        },
      ],
    });
  }

  async execute(
    data: RecordSupplierPaymentInput,
    userId = 1,
  ): Promise<SupplierLedgerEntry> {
    const result = await this.executeCommitPhase(data, userId);
    await this.executeSideEffectsPhase(result, data, userId);
    return result;
  }

  async executeSideEffectsPhase(
    entry: SupplierLedgerEntry,
    data: RecordSupplierPaymentInput,
    userId: number,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logAction(
        userId,
        "supplierLedger:payment",
        "Supplier",
        data.supplierId,
        `Recorded supplier payment for supplier #${data.supplierId}`,
        {
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          ledgerEntryId: entry.id,
          paymentId: entry.paymentId,
        },
      );
    } catch (error) {
      console.warn("Audit logging failed for supplier payment:", error);
    }
  }
}
