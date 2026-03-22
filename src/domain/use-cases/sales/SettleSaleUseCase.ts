import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { IPaymentRepository } from "../../interfaces/IPaymentRepository.js";
import { ICustomerRepository } from "../../interfaces/ICustomerRepository.js";
import { ICustomerLedgerRepository } from "../../interfaces/ICustomerLedgerRepository.js";
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
import { Sale } from "../../entities/Sale.js";
import type { PaymentMethod } from "../../entities/Payment.js";
import type { JournalLine } from "../../entities/Accounting.js";
import { MODULE_SETTING_KEYS } from "../../entities/ModuleSettings.js";
import { AuditService } from "../../shared/services/AuditService.js";
import { SettingsAccessor } from "../../shared/services/SettingsAccessor.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";
import type { DbConnection } from "../../../data/db/db.js";
import { withTransaction, type TxOrDb } from "../../../data/db/transaction.js";

export interface SettleSaleInput {
  saleId: number;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface SettleSaleResult {
  updatedSale: Sale;
  settledAmount: number;
}

export class SettleSaleUseCase extends WriteUseCase<
  SettleSaleInput,
  SettleSaleResult,
  { sale: Sale; settledAmount: number }
> {
  private auditService?: AuditService;

  constructor(
    private db: DbConnection,
    private saleRepo: ISaleRepository,
    private paymentRepo: IPaymentRepository,
    private customerRepo: ICustomerRepository,
    private customerLedgerRepo: ICustomerLedgerRepository,
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
    input: SettleSaleInput,
    userId: string,
  ): Promise<SettleSaleResult> {
    const numUserId = Number(userId) || 0;

    // Idempotency: if a payment already exists for this key, return the sale
    if (input.idempotencyKey) {
      const existingPayment = await this.paymentRepo.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existingPayment?.saleId) {
        const existingSale = await this.saleRepo.findById(
          existingPayment.saleId,
        );
        if (existingSale) {
          return {
            updatedSale: existingSale,
            settledAmount: existingPayment.amount,
          };
        }
      }
    }

    const sale = await this.saleRepo.findById(input.saleId);
    if (!sale) {
      throw new NotFoundError("Sale not found", { saleId: input.saleId });
    }

    if (sale.status === "cancelled") {
      throw new InvalidStateError("Cannot settle a cancelled sale", {
        saleId: sale.id,
        status: sale.status,
      });
    }

    if (sale.status === "refunded") {
      throw new InvalidStateError("Cannot settle a fully refunded sale", {
        saleId: sale.id,
        status: sale.status,
      });
    }

    if (sale.status === "completed") {
      throw new InvalidStateError("Sale is already fully settled", {
        saleId: sale.id,
        status: sale.status,
      });
    }

    if (sale.remainingAmount <= 0) {
      throw new InvalidStateError("Sale has no remaining balance to settle", {
        saleId: sale.id,
        remainingAmount: sale.remainingAmount,
      });
    }

    const paymentMethod = input.paymentMethod ?? "cash";

    if (paymentMethod === "card" && !input.referenceNumber?.trim()) {
      throw new ValidationError("Card payments require a reference number");
    }

    if (paymentMethod === "credit" && !sale.customerId) {
      throw new ValidationError(
        "Credit settlements require a customer on the sale",
      );
    }

    const currency = sale.currency || "IQD";
    const settleAmount = roundByCurrency(sale.remainingAmount, currency);

    const accountingEnabled = await this.isAccountingEnabled();
    const ledgersEnabled = await this.isLedgersEnabled();

    const updatedSale = await withTransaction(this.db, async (tx) => {
      const payment = await this.paymentRepo.createSync(
        {
          saleId: sale.id!,
          customerId: sale.customerId ?? undefined,
          amount: settleAmount,
          currency,
          exchangeRate: sale.exchangeRate,
          paymentMethod,
          referenceNumber: input.referenceNumber,
          notes: input.notes || `Settlement for sale #${sale.invoiceNumber}`,
          createdBy: numUserId,
          status: "completed",
          paymentDate: new Date(),
          idempotencyKey: input.idempotencyKey,
        },
        tx,
      );

      const newPaidAmount = roundByCurrency(
        sale.paidAmount + settleAmount,
        currency,
      );

      await this.saleRepo.update(
        sale.id!,
        {
          paidAmount: newPaidAmount,
          remainingAmount: 0,
          status: "completed",
          updatedAt: new Date(),
        },
        tx,
      );

      if (ledgersEnabled && sale.customerId) {
        const balanceBefore = await this.customerLedgerRepo.getLastBalanceSync(
          sale.customerId,
          tx,
        );
        await this.customerLedgerRepo.createSync(
          {
            customerId: sale.customerId,
            transactionType: "payment",
            amount: -settleAmount,
            balanceAfter: balanceBefore - settleAmount,
            saleId: sale.id,
            paymentId: payment.id,
            notes: input.notes || `Settlement for sale #${sale.invoiceNumber}`,
            createdBy: numUserId,
          },
          tx,
        );
      } else if (!ledgersEnabled && sale.customerId) {
        await this.customerRepo.updateDebt(sale.customerId, -settleAmount);
      }

      if (accountingEnabled) {
        await this.createSettlementJournalEntry(
          payment.id!,
          settleAmount,
          currency,
          numUserId,
          sale.customerId ?? undefined,
          tx,
        );
      }

      const refreshed = await this.saleRepo.findById(sale.id!, tx);
      if (!refreshed) {
        throw new NotFoundError("Sale not found after settlement", {
          saleId: sale.id,
        });
      }
      return refreshed;
    });

    return { updatedSale, settledAmount: settleAmount };
  }

  private async createSettlementJournalEntry(
    paymentId: number,
    amount: number,
    currency: string,
    userId: number,
    customerId?: number,
    tx?: TxOrDb,
  ): Promise<void> {
    // Use SettingsAccessor to resolve account codes instead of hardcoded strings,
    // so customised chart-of-accounts configurations are respected.
    // Fall back to canonical defaults ("1001", "1100") when settingsRepo is unavailable.
    let cashCode = "1001";
    let arCode = "1100";
    if (this.settingsRepo) {
      const settings = new SettingsAccessor(this.settingsRepo);
      cashCode = await settings.getCashAccountCode();
      arCode = await settings.getArAccountCode();
    }
    const cashAcct = await this.accountingRepo.findAccountByCode(cashCode, tx);
    const arAcct = await this.accountingRepo.findAccountByCode(arCode, tx);

    if (!cashAcct?.id || !arAcct?.id) {
      console.warn(
        "[SettleSaleUseCase] Missing cash/AR accounts, skipping journal entry",
      );
      return;
    }

    const autoPost = await this.resolveAutoPosting();

    const lines: JournalLine[] = [
      {
        accountId: cashAcct.id,
        debit: amount,
        credit: 0,
        balance: amount,
        description: "Cash received — sale settlement",
        reconciled: false,
      },
      {
        accountId: arAcct.id,
        partnerId: customerId ?? null,
        debit: 0,
        credit: amount,
        balance: -amount,
        description: "Accounts receivable cleared — sale settlement",
        reconciled: false,
      },
    ];

    await this.accountingRepo.createJournalEntrySync(
      {
        entryNumber: `JE-SETTLE-${paymentId}`,
        entryDate: new Date(),
        description: `Sale settlement payment #${paymentId}`,
        sourceType: "payment",
        sourceId: paymentId,
        isPosted: autoPost,
        isReversed: false,
        totalAmount: amount,
        currency,
        createdBy: userId,
        lines,
      },
      tx,
    );
  }

  async executeSideEffectsPhase(
    result: SettleSaleResult,
    userId: string,
  ): Promise<void> {
    if (!this.auditService) return;
    const numUserId = Number(userId) || 0;
    const sale = result.updatedSale;
    try {
      await this.auditService.logAction(
        numUserId,
        "sale:settle",
        "Sale",
        sale.id!,
        `Sale #${sale.id} settled — amount ${result.settledAmount}`,
        {
          saleId: sale.id,
          settledAmount: result.settledAmount,
          newStatus: sale.status,
        },
      );
    } catch (error) {
      console.warn("Audit logging failed for sale settlement:", error);
    }
  }

  toEntity(result: SettleSaleResult): { sale: Sale; settledAmount: number } {
    return { sale: result.updatedSale, settledAmount: result.settledAmount };
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

  private async resolveAutoPosting(): Promise<boolean> {
    return SettingsAccessor.resolveAutoPosting(
      this.settingsRepo,
      this.accountingSettingsRepo,
    );
  }
}
