import { ICustomerLedgerRepository } from "../../interfaces/ICustomerLedgerRepository.js";
import { ICustomerRepository } from "../../interfaces/ICustomerRepository.js";
import { IPaymentRepository } from "../../interfaces/IPaymentRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { IAccountingSettingsRepository } from "../../interfaces/IAccountingSettingsRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError, ValidationError } from "../../shared/errors/DomainErrors.js";
import { CustomerLedgerEntry } from "../../entities/Ledger.js";
import { AuditService } from "../../shared/services/AuditService.js";
import { SettingsAccessor } from "../../shared/services/SettingsAccessor.js";

export interface RecordPaymentInput {
  customerId: number;
  amount: number;
  paymentMethod: string;
  notes?: string;
  idempotencyKey?: string;
}

export class RecordCustomerPaymentUseCase {
  private auditService?: AuditService;

  constructor(
    private ledgerRepo: ICustomerLedgerRepository,
    private customerRepo: ICustomerRepository,
    private paymentRepo: IPaymentRepository,
    private accountingRepo: IAccountingRepository,
    auditRepo?: IAuditRepository,
    private settingsRepo?: ISettingsRepository,
    private accountingSettingsRepo?: IAccountingSettingsRepository,
  ) {
    if (auditRepo) {
      this.auditService = new AuditService(auditRepo);
    }
  }

  async executeCommitPhase(
    data: RecordPaymentInput,
    userId: number,
  ): Promise<CustomerLedgerEntry> {
    if (data.amount <= 0) {
      throw new ValidationError("Payment amount must be greater than zero");
    }
    if (!Number.isInteger(data.amount)) {
      throw new ValidationError("Payment amount must be an integer IQD amount");
    }

    const customer = await this.customerRepo.findById(data.customerId);
    if (!customer) {
      throw new NotFoundError("Customer not found");
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
      customerId: data.customerId,
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
      data.customerId,
    );
    const balanceAfter = balanceBefore - data.amount;

    const entry = await this.ledgerRepo.createSync({
      customerId: data.customerId,
      transactionType: "payment",
      amount: -data.amount,
      balanceAfter,
      paymentId: payment.id,
      notes: data.notes,
      createdBy: userId,
    });

    // Update cached totalDebt on customer record
    await this.customerRepo.updateDebt(data.customerId, balanceAfter);

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

  private async resolveAutoPosting(): Promise<boolean> {
    if (!this.settingsRepo) return false;
    const settings = new SettingsAccessor(
      this.settingsRepo,
      this.accountingSettingsRepo,
    );
    return settings.isAutoPostingEnabled();
  }

  private async createJournalEntry(
    paymentId: number,
    amount: number,
    userId: number,
  ): Promise<void> {
    // Resolve account codes from settings
    const settings = this.settingsRepo
      ? new SettingsAccessor(this.settingsRepo, this.accountingSettingsRepo)
      : null;
    const cashCode = settings ? await settings.getCashAccountCode() : "1001";
    const arCode = settings ? await settings.getArAccountCode() : "1100";

    const cashAcct = await this.accountingRepo.findAccountByCode(cashCode);
    const arAcct = await this.accountingRepo.findAccountByCode(arCode);
    if (!cashAcct?.id || !arAcct?.id) {
      console.warn(
        "[RecordCustomerPaymentUseCase] Missing cash/AR accounts, skipping journal",
      );
      return;
    }

    const autoPost = await this.resolveAutoPosting();

    await this.accountingRepo.createJournalEntrySync({
      entryNumber: `JE-CPAY-${paymentId}`,
      entryDate: new Date(),
      description: `Customer payment #${paymentId}`,
      sourceType: "payment",
      sourceId: paymentId,
      isPosted: autoPost,
      isReversed: false,
      totalAmount: amount,
      currency: "IQD",
      createdBy: userId,
      lines: [
        {
          accountId: cashAcct.id,
          debit: amount,
          credit: 0,
          description: "Cash received",
        },
        {
          accountId: arAcct.id,
          debit: 0,
          credit: amount,
          description: "AR settled",
        },
      ],
    });
  }

  async execute(
    data: RecordPaymentInput,
    userId = 1,
  ): Promise<CustomerLedgerEntry> {
    const result = await this.executeCommitPhase(data, userId);
    await this.executeSideEffectsPhase(result, data, userId);
    return result;
  }

  async executeSideEffectsPhase(
    entry: CustomerLedgerEntry,
    data: RecordPaymentInput,
    userId: number,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logAction(
        userId,
        "customerLedger:payment",
        "Customer",
        data.customerId,
        `Recorded customer payment for customer #${data.customerId}`,
        {
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          ledgerEntryId: entry.id,
          paymentId: entry.paymentId,
        },
      );
    } catch (error) {
      console.warn("Audit logging failed for customer payment:", error);
    }
  }
}
