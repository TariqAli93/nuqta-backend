import { ISupplierLedgerRepository } from "../../interfaces/ISupplierLedgerRepository.js";
import { ISupplierRepository } from "../../interfaces/ISupplierRepository.js";
import { IPaymentRepository } from "../../interfaces/IPaymentRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { IAccountingSettingsRepository } from "../../interfaces/IAccountingSettingsRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import {
  NotFoundError,
  ValidationError,
} from "../../shared/errors/DomainErrors.js";
import { SupplierLedgerEntry } from "../../entities/Ledger.js";
import { AuditService } from "../../shared/services/AuditService.js";
import { SettingsAccessor } from "../../shared/services/SettingsAccessor.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";
import type { DbConnection } from "../../../data/db/db.js";
import { withTransaction } from "../../../data/db/transaction.js";

export interface RecordSupplierPaymentInput {
  supplierId: number;
  amount: number;
  paymentMethod: string;
  notes?: string;
  idempotencyKey?: string;
}

export class RecordSupplierPaymentUseCase extends WriteUseCase<
  RecordSupplierPaymentInput,
  SupplierLedgerEntry,
  SupplierLedgerEntry
> {
  private auditService?: AuditService;

  constructor(
    private ledgerRepo: ISupplierLedgerRepository,
    private supplierRepo: ISupplierRepository,
    private paymentRepo: IPaymentRepository,
    private accountingRepo: IAccountingRepository,
    auditRepo?: IAuditRepository,
    private settingsRepo?: ISettingsRepository,
    private accountingSettingsRepo?: IAccountingSettingsRepository,
    private db?: DbConnection,
  ) {
    super();
    if (auditRepo) {
      this.auditService = new AuditService(auditRepo);
    }
  }

  async executeCommitPhase(
    data: RecordSupplierPaymentInput,
    userId: string,
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

    const numUserId = Number(userId) || 1;
    const accountingEnabled = await this.isAccountingEnabled();

    // Wrap all mutations in a single transaction for atomicity
    const executeMutations = async (_tx?: unknown) => {
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
        createdBy: numUserId,
      } as any);

      const balanceBefore = await this.ledgerRepo.getLastBalanceSync(
        data.supplierId,
      );
      const balanceAfter = balanceBefore - data.amount;

      const entry = await this.ledgerRepo.createSync({
        supplierId: data.supplierId,
        transactionType: "payment",
        amount: data.amount,
        balanceAfter,
        paymentId: payment.id,
        notes: data.notes,
        createdBy: numUserId,
      });

      // FIX: updatePayable does an INCREMENT (currentBalance + amountChange),
      // so we must pass -data.amount (the delta), NOT balanceAfter.
      await this.supplierRepo.updatePayable(data.supplierId, -data.amount);

      if (accountingEnabled) {
        await this.createJournalEntry(payment.id!, data.amount, numUserId);
      }

      return entry;
    };

    // Use transaction if db connection is available
    if (this.db) {
      return withTransaction(this.db, async (tx) => executeMutations(tx));
    }
    return executeMutations();
  }

  private async isAccountingEnabled(): Promise<boolean> {
    if (!this.settingsRepo) return true;
    const settings = new SettingsAccessor(this.settingsRepo);
    return settings.isAccountingEnabled();
  }

  private async resolveAutoPosting(): Promise<boolean> {
    return SettingsAccessor.resolveAutoPosting(
      this.settingsRepo,
      this.accountingSettingsRepo,
    );
  }

  private async createJournalEntry(
    paymentId: number,
    amount: number,
    userId: number,
  ): Promise<void> {
    const settings = this.settingsRepo
      ? new SettingsAccessor(this.settingsRepo, this.accountingSettingsRepo)
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

    const autoPost = await this.resolveAutoPosting();

    await this.accountingRepo.createJournalEntrySync({
      entryNumber: `JE-SPAY-${paymentId}`,
      entryDate: new Date(),
      description: `Supplier payment #${paymentId}`,
      sourceType: "payment",
      sourceId: paymentId,
      isPosted: autoPost,
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
          balance: 0,
          reconciled: false,
        },
        {
          accountId: cashAcct.id,
          debit: 0,
          credit: amount,
          description: "Cash paid",
          balance: 0,
          reconciled: false,
        },
      ],
    });
  }

  async executeSideEffectsPhase(
    entry: SupplierLedgerEntry,
    userId: string,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logAction(
        Number(userId) || 1,
        "supplierLedger:payment",
        "Supplier",
        entry.supplierId,
        `Recorded supplier payment for supplier #${entry.supplierId}`,
        {
          amount: entry.amount,
          ledgerEntryId: entry.id,
          paymentId: entry.paymentId,
        },
      );
    } catch (error) {
      console.warn("Audit logging failed for supplier payment:", error);
    }
  }

  toEntity(result: SupplierLedgerEntry): SupplierLedgerEntry {
    return result;
  }
}
