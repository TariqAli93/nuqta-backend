import { IPurchaseRepository } from "../../interfaces/IPurchaseRepository.js";
import { IPaymentRepository } from "../../interfaces/IPaymentRepository.js";
import { ISupplierLedgerRepository } from "../../interfaces/ISupplierLedgerRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { IAccountingSettingsRepository } from "../../interfaces/IAccountingSettingsRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import {
  NotFoundError,
  InvalidStateError,
  ValidationError,
} from "../../shared/errors/DomainErrors.js";
import { roundByCurrency } from "../../shared/utils/helpers.js";
import { Purchase } from "../../entities/Purchase.js";
import type { PaymentMethod } from "../../entities/Payment.js";
import type { JournalLine } from "../../entities/Accounting.js";
import { MODULE_SETTING_KEYS } from "../../entities/ModuleSettings.js";
import { AuditService } from "../../shared/services/AuditService.js";
import { SettingsAccessor } from "../../shared/services/SettingsAccessor.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";
import type { DbConnection } from "../../../data/db/db.js";
import { withTransaction, type TxOrDb } from "../../../data/db/transaction.js";

export interface AddPurchasePaymentInput {
  purchaseId: number;
  supplierId?: number;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
}

/**
 * AddPurchasePaymentUseCase
 * Adds a payment to a purchase invoice in one transaction-safe commit phase:
 * 1) validate + clamp payment amount against remaining amount
 * 2) insert payment
 * 3) update purchase paid/remaining/status
 * 4) insert supplier ledger entry (if ledgers are enabled)
 * 5) create draft journal entry (if accounting is enabled)
 */
export class AddPurchasePaymentUseCase extends WriteUseCase<
  AddPurchasePaymentInput,
  { updatedPurchase: Purchase },
  Purchase
> {
  private auditService?: AuditService;

  constructor(
    private db: DbConnection,
    private purchaseRepo: IPurchaseRepository,
    private paymentRepo: IPaymentRepository,
    private supplierLedgerRepo: ISupplierLedgerRepository,
    private accountingRepo: IAccountingRepository,
    private settingsRepo?: ISettingsRepository,
    auditRepo?: IAuditRepository,
    private accountingSettingsRepo?: IAccountingSettingsRepository,
  ) {
    super();
    if (auditRepo) {
      this.auditService = new AuditService(auditRepo);
    }
  }

  async executeCommitPhase(
    input: AddPurchasePaymentInput,
    userId: string,
  ): Promise<{ updatedPurchase: Purchase }> {
    const numUserId = Number(userId) || 0;
    // Idempotency check
    if (input.idempotencyKey) {
      const existing = await this.paymentRepo.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existing?.purchaseId) {
        const existingPurchase = await this.findPurchaseSync(
          existing.purchaseId,
        );
        if (existingPurchase) {
          return { updatedPurchase: existingPurchase };
        }
        return { updatedPurchase: { id: existing.purchaseId } as Purchase };
      }
    }

    if (input.amount <= 0) {
      throw new ValidationError("Payment amount must be greater than zero", {
        amount: input.amount,
      });
    }

    if (!Number.isInteger(input.amount)) {
      throw new ValidationError(
        "Payment amount must be an integer IQD amount",
        {
          amount: input.amount,
        },
      );
    }

    if (input.paymentMethod === "card" && !input.referenceNumber?.trim()) {
      throw new ValidationError("Card payments require a reference number");
    }

    const purchase = await this.findPurchaseSync(input.purchaseId);
    if (!purchase) {
      throw new NotFoundError("Purchase not found", {
        purchaseId: input.purchaseId,
      });
    }

    if (purchase.status === "cancelled") {
      throw new InvalidStateError("Cannot add payment to cancelled purchase", {
        purchaseId: purchase.id,
        status: purchase.status,
      });
    }

    if ((purchase.remainingAmount || 0) <= 0) {
      throw new InvalidStateError("Purchase is already fully paid", {
        purchaseId: purchase.id,
      });
    }

    const currency = input.currency || purchase.currency || "IQD";
    if (
      currency === "IQD" &&
      (!Number.isInteger(purchase.remainingAmount || 0) ||
        !Number.isInteger(purchase.paidAmount || 0) ||
        !Number.isInteger(purchase.total || 0))
    ) {
      throw new InvalidStateError(
        "Purchase amounts must be integer IQD values",
        {
          purchaseId: purchase.id,
          remainingAmount: purchase.remainingAmount,
          paidAmount: purchase.paidAmount,
          total: purchase.total,
        },
      );
    }
    const requestedAmount = roundByCurrency(input.amount, currency);
    const currentRemaining = roundByCurrency(
      purchase.remainingAmount || 0,
      currency,
    );
    const amount = Math.min(requestedAmount, currentRemaining);

    if (amount <= 0) {
      throw new ValidationError("Payment amount exceeds remaining balance", {
        requestedAmount,
        currentRemaining,
      });
    }

    const threshold = currency === "IQD" ? 0 : 0.01;
    const newPaidAmount = roundByCurrency(
      (purchase.paidAmount || 0) + amount,
      currency,
    );
    let newRemainingAmount = roundByCurrency(
      Math.max(0, (purchase.total || 0) - newPaidAmount),
      currency,
    );
    if (newRemainingAmount < threshold) {
      newRemainingAmount = 0;
    }

    const supplierId = input.supplierId || purchase.supplierId;

    // Pre-fetch settings outside the transaction (read-only, no locks needed)
    const ledgersEnabled = await this.isLedgersEnabled();
    const accountingEnabled = await this.isAccountingEnabled();

    const updatedPurchase = await withTransaction(this.db, async (tx) => {
      const payment = await this.paymentRepo.createSync({
        purchaseId: input.purchaseId,
        supplierId,
        amount,
        currency,
        exchangeRate: input.exchangeRate || purchase.exchangeRate || 1,
        paymentMethod: input.paymentMethod || "cash",
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        createdBy: numUserId,
        status: "completed",
        paymentDate: new Date(),
        idempotencyKey: input.idempotencyKey,
      } as any, tx);

      const newStatus = newRemainingAmount <= 0 ? "completed" : "pending";

      await this.updatePurchasePaymentSync(
        input.purchaseId,
        newPaidAmount,
        newRemainingAmount,
        tx,
      );

      // Only advance status to "completed" on full payment; never regress a
      // received/partial purchase back to "pending" on a partial payment.
      if (newRemainingAmount <= 0) {
        if (typeof this.purchaseRepo.updateStatusSync === "function") {
          await this.purchaseRepo.updateStatusSync(input.purchaseId, newStatus, tx);
        } else if (typeof this.purchaseRepo.updateStatus === "function") {
          await this.purchaseRepo.updateStatus(input.purchaseId, newStatus, tx);
        }
      }

      if (ledgersEnabled && supplierId) {
        const balanceBefore =
          await this.supplierLedgerRepo.getLastBalanceSync(supplierId, tx);
        await this.supplierLedgerRepo.createSync({
          supplierId,
          transactionType: "payment",
          amount: -amount,
          balanceAfter: balanceBefore - amount,
          purchaseId: input.purchaseId,
          paymentId: payment.id,
          notes: input.notes || `Payment for purchase #${input.purchaseId}`,
          createdBy: numUserId,
        } as any, tx);
      }

      if (accountingEnabled) {
        await this.createPaymentJournalEntry(
          payment.id!,
          amount,
          currency,
          numUserId,
          input.purchaseId,
          supplierId,
          tx,
        );
      }

      const result = await this.findPurchaseSync(input.purchaseId, tx);
      if (!result) {
        throw new NotFoundError("Purchase not found after payment update", {
          purchaseId: input.purchaseId,
        });
      }
      return result;
    });

    return { updatedPurchase };
  }

  private async createPaymentJournalEntry(
    paymentId: number,
    amount: number,
    currency: string,
    userId: number,
    purchaseId: number,
    supplierId?: number,
    tx?: TxOrDb,
  ): Promise<void> {
    // Resolve account codes from settings (not hardcoded)
    const settings = this.settingsRepo
      ? new SettingsAccessor(this.settingsRepo)
      : null;
    const cashCode = settings ? await settings.getCashAccountCode() : "1001";
    const apCode = settings ? await settings.getApAccountCode() : "2100";

    const cashAcct = await this.accountingRepo.findAccountByCode(cashCode, tx);
    const apAcct = await this.accountingRepo.findAccountByCode(apCode, tx);
    if (!cashAcct?.id || !apAcct?.id) {
      console.warn(
        "[AddPurchasePaymentUseCase] Missing cash/AP accounts, skipping journal entry",
      );
      return;
    }

    const autoPost = await this.resolveAutoPosting();

    const lines: JournalLine[] = [
      {
        accountId: apAcct.id,
        partnerId: supplierId ?? null,
        debit: amount,
        credit: 0,
        balance: amount,
        description: "Accounts payable settlement",
        reconciled: false,
      },
      {
        accountId: cashAcct.id,
        debit: 0,
        credit: amount,
        balance: -amount,
        description: "Cash paid to supplier",
        reconciled: false,
      },
    ];

    await this.accountingRepo.createJournalEntrySync({
      entryNumber: `JE-PPAY-${paymentId}`,
      entryDate: new Date(),
      description: `Supplier payment #${paymentId} for purchase #${purchaseId}`,
      sourceType: "payment",
      sourceId: paymentId,
      isPosted: autoPost,
      isReversed: false,
      totalAmount: amount,
      currency,
      createdBy: userId,
      lines,
    }, tx);
  }

  async executeSideEffectsPhase(
    result: { updatedPurchase: Purchase },
    userId: string,
  ): Promise<void> {
    if (!this.auditService) return;
    const numUserId = Number(userId) || 0;
    const purchase = result.updatedPurchase;
    try {
      await this.auditService.logAction(
        numUserId,
        "purchase:payment:add",
        "Purchase",
        purchase.id!,
        `Payment added to purchase #${purchase.id}`,
        {
          purchaseId: purchase.id,
          remainingAmount: purchase.remainingAmount,
        },
      );
    } catch (error) {
      console.warn("Audit logging failed for purchase payment:", error);
    }
  }

  toEntity(result: { updatedPurchase: Purchase }): Purchase {
    return result.updatedPurchase;
  }

  private async isAccountingEnabled(): Promise<boolean> {
    if (!this.settingsRepo) return false;
    const value =
      (await this.settingsRepo.get(MODULE_SETTING_KEYS.ACCOUNTING_ENABLED)) ??
      (await this.settingsRepo.get("modules.accounting.enabled"));
    return value === "true";
  }

  private async isLedgersEnabled(): Promise<boolean> {
    if (!this.settingsRepo) return true;
    const value =
      (await this.settingsRepo.get(MODULE_SETTING_KEYS.LEDGERS_ENABLED)) ??
      (await this.settingsRepo.get("modules.ledgers.enabled"));
    return value !== "false";
  }

  private async resolveAutoPosting(): Promise<boolean> {
    return SettingsAccessor.resolveAutoPosting(
      this.settingsRepo,
      this.accountingSettingsRepo,
    );
  }

  private async findPurchaseSync(id: number, tx?: TxOrDb): Promise<Purchase | null> {
    if (typeof this.purchaseRepo.findByIdSync === "function") {
      return await this.purchaseRepo.findByIdSync(id, tx);
    }
    return await this.purchaseRepo.findById(id, tx);
  }

  private async updatePurchasePaymentSync(
    id: number,
    paidAmount: number,
    remainingAmount: number,
    tx?: TxOrDb,
  ): Promise<void> {
    if (typeof this.purchaseRepo.updatePaymentSync === "function") {
      await this.purchaseRepo.updatePaymentSync(
        id,
        paidAmount,
        remainingAmount,
        tx,
      );
      return;
    }
    // Backward-compatible fallback for repositories exposing async signatures only.
    await this.purchaseRepo.updatePayment(id, paidAmount, remainingAmount, tx);
  }
}
