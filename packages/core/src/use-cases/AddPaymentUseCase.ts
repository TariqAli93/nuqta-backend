import { ISaleRepository } from "../interfaces/ISaleRepository.js";
import { IPaymentRepository } from "../interfaces/IPaymentRepository.js";
import { ICustomerRepository } from "../interfaces/ICustomerRepository.js";
import { ICustomerLedgerRepository } from "../interfaces/ICustomerLedgerRepository.js";
import { IAccountingRepository } from "../interfaces/IAccountingRepository.js";
import { ISettingsRepository } from "../interfaces/ISettingsRepository.js";
import { IAuditRepository } from "../interfaces/IAuditRepository.js";
import {
  NotFoundError,
  InvalidStateError,
  ValidationError,
} from "../errors/DomainErrors.js";
import { roundByCurrency } from "../utils/helpers.js";
import { Sale } from "../entities/Sale.js";
import type { PaymentMethod } from "../entities/Payment.js";
import type { JournalLine } from "../entities/Accounting.js";
import { MODULE_SETTING_KEYS } from "../entities/ModuleSettings.js";
import { AuditService } from "../services/AuditService.js";

const ACCT_CASH = "1001";
const ACCT_AR = "1100";

export interface AddPaymentInput {
  saleId: number;
  customerId?: number;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface AddPaymentCommitResult {
  updatedSale: Sale;
}

export class AddPaymentUseCase {
  private auditService?: AuditService;

  constructor(
    private saleRepo: ISaleRepository,
    private paymentRepo: IPaymentRepository,
    private customerRepo: ICustomerRepository,
    private customerLedgerRepo: ICustomerLedgerRepository,
    private accountingRepo: IAccountingRepository,
    private settingsRepo?: ISettingsRepository,
    auditRepo?: IAuditRepository,
  ) {
    if (auditRepo) {
      this.auditService = new AuditService(auditRepo);
    }
  }

  async executeCommitPhase(
    input: AddPaymentInput,
    userId: number,
  ): Promise<AddPaymentCommitResult> {
    if (input.idempotencyKey) {
      const existingPayment = await this.paymentRepo.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existingPayment?.saleId) {
        const existingSale = await this.saleRepo.findById(
          existingPayment.saleId,
        );
        if (existingSale) {
          return { updatedSale: existingSale };
        }
      }
    }

    const sale = await this.saleRepo.findById(input.saleId);
    if (!sale)
      throw new NotFoundError("Sale not found", { saleId: input.saleId });

    if (sale.status === "cancelled") {
      throw new InvalidStateError("Cannot add payment to cancelled sale", {
        saleId: sale.id,
        status: sale.status,
      });
    }

    if (sale.remainingAmount <= 0) {
      throw new InvalidStateError("Sale is already fully paid", {
        saleId: sale.id,
      });
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

    if (
      input.paymentMethod === "credit" &&
      !sale.customerId &&
      !input.customerId
    ) {
      throw new ValidationError("Credit/debt payments require a customer");
    }

    const currency = sale.currency || "IQD";
    if (
      currency === "IQD" &&
      (!Number.isInteger(sale.remainingAmount) ||
        !Number.isInteger(sale.paidAmount) ||
        !Number.isInteger(sale.total))
    ) {
      throw new InvalidStateError("Sale amounts must be integer IQD values", {
        saleId: sale.id,
        remainingAmount: sale.remainingAmount,
        paidAmount: sale.paidAmount,
        total: sale.total,
      });
    }
    const amount = roundByCurrency(input.amount, currency);
    const saleRemaining = roundByCurrency(sale.remainingAmount, currency);

    const actualPaymentAmount = Math.min(amount, saleRemaining);

    const payment = await this.paymentRepo.createSync({
      saleId: sale.id!,
      customerId: sale.customerId || input.customerId || undefined,
      amount: actualPaymentAmount,
      currency: input.currency || currency,
      exchangeRate: input.exchangeRate || sale.exchangeRate,
      paymentMethod: input.paymentMethod || "cash",
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      createdBy: userId,
      status: "completed",
      paymentDate: new Date(),
      idempotencyKey: input.idempotencyKey,
    });

    const newPaidAmount = roundByCurrency(
      sale.paidAmount + actualPaymentAmount,
      currency,
    );
    let newRemainingAmount = roundByCurrency(
      sale.remainingAmount - actualPaymentAmount,
      currency,
    );

    const threshold = currency === "IQD" ? 0 : 0.01;
    if (newRemainingAmount < threshold) newRemainingAmount = 0;

    const newStatus = newRemainingAmount <= 0 ? "completed" : "pending";

    await this.saleRepo.update(sale.id!, {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      status: newStatus,
      updatedAt: new Date(),
    });

    const accountingEnabled = await this.isAccountingEnabled();
    const ledgersEnabled = await this.isLedgersEnabled();
    const effectiveCustomerId = sale.customerId || input.customerId;
    if (ledgersEnabled && effectiveCustomerId) {
      const balanceBefore =
        await this.customerLedgerRepo.getLastBalanceSync(effectiveCustomerId);
      await this.customerLedgerRepo.createSync({
        customerId: effectiveCustomerId,
        transactionType: "payment",
        amount: -actualPaymentAmount,
        balanceAfter: balanceBefore - actualPaymentAmount,
        saleId: sale.id,
        paymentId: payment.id,
        notes: input.notes || `Payment for sale #${sale.invoiceNumber}`,
        createdBy: userId,
      });
    } else if (!ledgersEnabled && sale.customerId) {
      // Legacy fallback when ledgers are intentionally disabled.
      await this.customerRepo.updateDebt(sale.customerId, -actualPaymentAmount);
    }

    if (accountingEnabled) {
      await this.createPaymentJournalEntry(
        payment.id!,
        actualPaymentAmount,
        currency,
        userId,
      );
    }

    const updatedSale = await this.saleRepo.findById(sale.id!);
    if (!updatedSale) {
      throw new NotFoundError("Sale not found after payment update", {
        saleId: sale.id,
      });
    }

    return { updatedSale };
  }

  private async createPaymentJournalEntry(
    paymentId: number,
    amount: number,
    currency: string,
    userId: number,
  ): Promise<void> {
    const cashAcct = await this.accountingRepo.findAccountByCode(ACCT_CASH);
    const arAcct = await this.accountingRepo.findAccountByCode(ACCT_AR);

    if (!cashAcct?.id || !arAcct?.id) {
      console.warn(
        "[AddPaymentUseCase] Missing cash/AR accounts, skipping journal entry",
      );
      return;
    }

    const lines: JournalLine[] = [
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
        description: "Accounts receivable settlement",
      },
    ];

    await this.accountingRepo.createJournalEntrySync({
      entryNumber: `JE-PAY-${paymentId}`,
      entryDate: new Date(),
      description: `Customer payment #${paymentId}`,
      sourceType: "payment",
      sourceId: paymentId,
      isPosted: false,
      isReversed: false,
      totalAmount: amount,
      currency,
      createdBy: userId,
      lines,
    });
  }

  async execute(input: AddPaymentInput, userId: number): Promise<Sale> {
    const result = await this.executeCommitPhase(input, userId);
    await this.executeSideEffectsPhase(result, input, userId);
    return result.updatedSale;
  }

  async executeSideEffectsPhase(
    result: AddPaymentCommitResult,
    input: AddPaymentInput,
    userId: number,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logAction(
        userId,
        "sale:payment:add",
        "Sale",
        input.saleId,
        `Payment added to sale #${input.saleId}`,
        {
          saleId: input.saleId,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          remainingAmount: result.updatedSale.remainingAmount,
        },
      );
    } catch (error) {
      console.warn("Audit logging failed for sale payment:", error);
    }
  }

  private async isAccountingEnabled(): Promise<boolean> {
    if (!this.settingsRepo) return true;
    const value =
      (await this.settingsRepo.get(MODULE_SETTING_KEYS.ACCOUNTING_ENABLED)) ??
      (await this.settingsRepo.get("modules.accounting.enabled"));
    return value !== "false";
  }

  private async isLedgersEnabled(): Promise<boolean> {
    if (!this.settingsRepo) return true;
    const value =
      (await this.settingsRepo.get(MODULE_SETTING_KEYS.LEDGERS_ENABLED)) ??
      (await this.settingsRepo.get("modules.ledgers.enabled"));
    return value !== "false";
  }
}
