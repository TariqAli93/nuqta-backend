import { ICustomerLedgerRepository } from "../../interfaces/ICustomerLedgerRepository.js";
import { ICustomerRepository } from "../../interfaces/ICustomerRepository.js";
import { IPaymentRepository } from "../../interfaces/IPaymentRepository.js";
import { IPaymentAllocationRepository } from "../../interfaces/IPaymentAllocationRepository.js";
import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { IAccountingSettingsRepository } from "../../interfaces/IAccountingSettingsRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import {
  NotFoundError,
  ValidationError,
} from "../../shared/errors/DomainErrors.js";
import { derivePaymentStatus } from "../../shared/utils/helpers.js";
import { CustomerLedgerEntry } from "../../entities/Ledger.js";
import { AuditService } from "../../shared/services/AuditService.js";
import { SettingsAccessor } from "../../shared/services/SettingsAccessor.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";
import type { DbConnection } from "../../../data/db/db.js";
import { withTransaction, type TxOrDb } from "../../../data/db/transaction.js";

export interface RecordPaymentInput {
  customerId: number;
  amount: number;
  paymentMethod: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface RecordPaymentResult {
  ledgerEntry: CustomerLedgerEntry;
  allocations: Array<{ saleId: number; amount: number }>;
  unappliedAmount: number;
}

export class RecordCustomerPaymentUseCase extends WriteUseCase<
  RecordPaymentInput,
  RecordPaymentResult,
  RecordPaymentResult
> {
  private auditService?: AuditService;

  constructor(
    private ledgerRepo: ICustomerLedgerRepository,
    private customerRepo: ICustomerRepository,
    private paymentRepo: IPaymentRepository,
    private saleRepo: ISaleRepository,
    private paymentAllocationRepo: IPaymentAllocationRepository,
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
    data: RecordPaymentInput,
    userId: string,
  ): Promise<RecordPaymentResult> {
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
        if (existingEntry) {
          const existingAllocations =
            await this.paymentAllocationRepo.findByPaymentId(
              existingPayment.id,
            );
          const unapplied =
            existingPayment.amount -
            existingAllocations.reduce((s, a) => s + a.amount, 0);
          return {
            ledgerEntry: existingEntry,
            allocations: existingAllocations.map((a) => ({
              saleId: a.saleId,
              amount: a.amount,
            })),
            unappliedAmount: Math.max(0, unapplied),
          };
        }
      }
    }

    const numUserId = Number(userId) || 1;
    const accountingEnabled = await this.isAccountingEnabled();

    if (!this.db) {
      throw new ValidationError(
        "Database connection required for customer payment settlement",
      );
    }

    return withTransaction(this.db, async (tx) => {
      // 1. Create payment record
      const payment = await this.paymentRepo.createSync(
        {
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
          createdBy: numUserId,
        } as any,
        tx,
      );

      // 2. Fetch open invoices for this customer (FIFO: createdAt ASC, id ASC)
      const openInvoices = await this.saleRepo.findOpenByCustomerId(
        data.customerId,
        tx,
      );

      // 3. Compute total open debt
      const totalOpenDebt = openInvoices.reduce(
        (sum, inv) => sum + inv.remainingAmount,
        0,
      );

      // 4. Reject if payment exceeds total debt — prevent accounting corruption
      if (data.amount > totalOpenDebt && totalOpenDebt > 0) {
        throw new ValidationError(
          "Payment amount exceeds total outstanding invoice debt",
          {
            paymentAmount: data.amount,
            totalOpenDebt,
          },
        );
      }

      // If customer has no open invoices, reject (ledger-only payments with no
      // invoices would create accounting inconsistency)
      if (openInvoices.length === 0) {
        throw new ValidationError("Customer has no open invoices to settle", {
          customerId: data.customerId,
        });
      }

      // 5. FIFO allocation across open invoices
      let remainingPayment = data.amount;
      const allocationResults: Array<{ saleId: number; amount: number }> = [];

      for (const invoice of openInvoices) {
        if (remainingPayment <= 0) break;

        const invoiceRemaining = invoice.remainingAmount;
        const allocation = Math.min(remainingPayment, invoiceRemaining);

        // Create allocation row
        await this.paymentAllocationRepo.create(
          {
            paymentId: payment.id!,
            saleId: invoice.id!,
            amount: allocation,
          },
          tx,
        );

        // Update invoice financial state
        const newPaidAmount = invoice.paidAmount + allocation;
        const newRemainingAmount = Math.max(0, invoice.total - newPaidAmount);
        const newPaymentStatus = derivePaymentStatus(
          newPaidAmount,
          invoice.total,
        );
        const newStatus =
          newPaymentStatus === "paid" ? "completed" : invoice.status;

        await this.saleRepo.update(
          invoice.id!,
          {
            paidAmount: newPaidAmount,
            remainingAmount: newRemainingAmount,
            status: newStatus,
            updatedAt: new Date(),
          },
          tx,
        );

        allocationResults.push({
          saleId: invoice.id!,
          amount: allocation,
        });

        remainingPayment -= allocation;
      }

      // 6. Update customer ledger
      const balanceBefore = await this.ledgerRepo.getLastBalanceSync(
        data.customerId,
        tx,
      );
      const balanceAfter = balanceBefore - data.amount;

      const entry = await this.ledgerRepo.createSync(
        {
          customerId: data.customerId,
          transactionType: "payment",
          amount: -data.amount,
          balanceAfter,
          paymentId: payment.id,
          notes: data.notes,
          createdBy: numUserId,
        },
        tx,
      );

      // 7. Update denormalized customer debt
      await this.customerRepo.updateDebt(data.customerId, -data.amount);

      // 8. Create journal entry if accounting is enabled
      if (accountingEnabled) {
        await this.createJournalEntry(
          payment.id!,
          data.amount,
          numUserId,
          data.customerId,
          tx,
        );
      }

      return {
        ledgerEntry: entry,
        allocations: allocationResults,
        unappliedAmount: Math.max(0, remainingPayment),
      };
    });
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
    customerId: number,
    tx?: TxOrDb,
  ): Promise<void> {
    const settings = this.settingsRepo
      ? new SettingsAccessor(this.settingsRepo, this.accountingSettingsRepo)
      : null;
    const cashCode = settings ? await settings.getCashAccountCode() : "1001";
    const arCode = settings ? await settings.getArAccountCode() : "1100";

    const cashAcct = await this.accountingRepo.findAccountByCode(cashCode, tx);
    const arAcct = await this.accountingRepo.findAccountByCode(arCode, tx);
    if (!cashAcct?.id || !arAcct?.id) {
      console.warn(
        "[RecordCustomerPaymentUseCase] Missing cash/AR accounts, skipping journal",
      );
      return;
    }

    const autoPost = await this.resolveAutoPosting();

    await this.accountingRepo.createJournalEntrySync(
      {
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
            balance: 0,
            reconciled: false,
          },
          {
            accountId: arAcct.id,
            partnerId: customerId,
            debit: 0,
            credit: amount,
            description: "AR settled",
            balance: 0,
            reconciled: false,
          },
        ],
      },
      tx,
    );
  }

  async executeSideEffectsPhase(
    result: RecordPaymentResult,
    userId: string,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logAction(
        Number(userId) || 1,
        "customerLedger:payment",
        "Customer",
        result.ledgerEntry.customerId,
        `Recorded customer payment for customer #${result.ledgerEntry.customerId}`,
        {
          amount: result.ledgerEntry.amount,
          ledgerEntryId: result.ledgerEntry.id,
          paymentId: result.ledgerEntry.paymentId,
          allocations: result.allocations,
          unappliedAmount: result.unappliedAmount,
        },
      );
    } catch (error) {
      console.warn("Audit logging failed for customer payment:", error);
    }
  }

  toEntity(result: RecordPaymentResult): RecordPaymentResult {
    return result;
  }
}
