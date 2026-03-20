/**
 * CancelSaleUseCase
 *
 * Fully reverses a sale:
 *  1. Restores inventory for every batch-depletion record
 *  2. Creates reversal journal entry (accounting)
 *  3. Voids all associated payments and creates payment-reversal journal entries
 *  4. Creates a cancellation entry in the customer ledger
 *  5. Marks the sale as "cancelled"
 *
 * All steps run inside a single database transaction so that a failure in any
 * step rolls back the entire operation — no partial writes.
 */
import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { IProductRepository } from "../../interfaces/IProductRepository.js";
import { IInventoryRepository } from "../../interfaces/IInventoryRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { ICustomerLedgerRepository } from "../../interfaces/ICustomerLedgerRepository.js";
import { IPaymentRepository } from "../../interfaces/IPaymentRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { Sale } from "../../entities/Sale.js";
import {
  NotFoundError,
  InvalidStateError,
} from "../../shared/errors/DomainErrors.js";
import { AuditEvent } from "../../entities/AuditEvent.js";
import { SettingsAccessor } from "../../shared/services/SettingsAccessor.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";
import type { DbConnection } from "../../../data/db/db.js";
import { withTransaction } from "../../../data/db/transaction.js";

type TInput = { saleId: number };

type TCancelResult = {
  sale: Sale;
  depletionsRestored: number;
};

export class CancelSaleUseCase extends WriteUseCase<
  TInput,
  TCancelResult,
  void
> {
  constructor(
    private db: DbConnection,
    private saleRepo: ISaleRepository,
    private inventoryRepo: IInventoryRepository,
    private accountingRepo: IAccountingRepository,
    private customerLedgerRepo: ICustomerLedgerRepository,
    private paymentRepo: IPaymentRepository,
    private settingsRepo: ISettingsRepository,
    private auditRepo?: IAuditRepository,
    private productRepo?: IProductRepository,
  ) {
    super();
  }

  async executeCommitPhase(
    input: TInput,
    userId: string,
  ): Promise<TCancelResult> {
    const numUserId = Number(userId) || 0;

    // Pre-fetch settings outside tx (read-only, no need to hold lock)
    const settingsAccessor = new SettingsAccessor(this.settingsRepo);
    const accountingEnabled = await settingsAccessor.isAccountingEnabled();
    const ledgersEnabled = await settingsAccessor.isLedgersEnabled();

    return withTransaction(this.db, async (tx) => {
      // 1. Fetch the sale with its items and depletions
      const sale = await this.saleRepo.findById(input.saleId, tx);
      if (!sale) throw new NotFoundError("الفاتورة غير موجودة");
      if (sale.status === "cancelled")
        throw new InvalidStateError("الفاتورة ملغية بالفعل");
      if (sale.status === "refunded")
        throw new InvalidStateError("لا يمكن إلغاء فاتورة تم استردادها بالكامل");

      // Guard: block cancel when refund payments exist to prevent double inventory reversal
      const existingPayments = await this.paymentRepo.findBySaleId(
        input.saleId,
        tx,
      );
      const hasRefunds = existingPayments.some((p) => p.status === "refunded");
      if (hasRefunds)
        throw new InvalidStateError(
          "لا يمكن إلغاء فاتورة تم معالجة استرداد لها — قم بمراجعة حركات الاسترداد أولاً",
        );

      // 2. Restore inventory for every batch-depletion
      const depletions = await this.saleRepo.getItemDepletionsBySaleId(
        input.saleId,
        tx,
      );

      // Group depletions by product so we can track running stock per product
      const productStockMap = new Map<number, number>();

      for (const dep of depletions) {
        // Fetch current product stock once per product (before any restores)
        if (!productStockMap.has(dep.productId)) {
          if (this.productRepo) {
            const product = await this.productRepo.findById(dep.productId, tx);
            productStockMap.set(dep.productId, product?.stock ?? 0);
            if (!product) {
              console.warn(
                `[CancelSaleUseCase] Product ${dep.productId} not found during cancel stock lookup, using 0`,
              );
            }
          } else {
            productStockMap.set(dep.productId, 0);
          }
        }

        const stockBefore = productStockMap.get(dep.productId)!;
        const stockAfter = stockBefore + dep.quantityBase;
        productStockMap.set(dep.productId, stockAfter);

        await this.inventoryRepo.restoreBatchQty(
          dep.batchId,
          dep.quantityBase,
          tx,
        );
        await this.inventoryRepo.createMovement(
          {
            productId: dep.productId,
            batchId: dep.batchId,
            movementType: "in",
            reason: "cancellation",
            quantityBase: dep.quantityBase,
            unitName: "piece",
            unitFactor: 1,
            costPerUnit: dep.costPerUnit,
            totalCost: dep.totalCost,
            sourceType: "sale_cancellation",
            sourceId: sale.id!,
            notes: `إلغاء فاتورة #${sale.invoiceNumber}`,
            createdBy: numUserId,
            stockBefore,
            stockAfter,
          },
          tx,
        );
      }

      // 3. Reversal journal entries
      if (accountingEnabled) {
        const originalEntry = await this.accountingRepo.findEntryBySource(
          "sale",
          sale.id!,
          tx,
        );
        if (originalEntry?.id) {
          await this.accountingRepo.createReversalEntry(
            {
              originalEntryId: originalEntry.id,
              reversalDate: new Date(),
              description: `إلغاء فاتورة #${sale.invoiceNumber}`,
              sourceType: "sale_cancellation",
              sourceId: sale.id!,
              createdBy: numUserId,
            },
            tx,
          );
        }

        // Reverse only the *separately recorded* payment journal entries.
        // The original sale entry already includes the initial payment lines,
        // so only subsequent AddPayment entries (sourceType="payment") need
        // individual reversal to avoid double-reversing Cash/AR.
        const completedPayments = existingPayments.filter(
          (p) => p.status === "completed",
        );
        for (const payment of completedPayments) {
          const paymentEntry = await this.accountingRepo.findEntryBySource(
            "payment",
            payment.id!,
            tx,
          );
          if (paymentEntry?.id) {
            await this.accountingRepo.createReversalEntry(
              {
                originalEntryId: paymentEntry.id,
                reversalDate: new Date(),
                description: `استرداد دفع - إلغاء فاتورة #${sale.invoiceNumber}`,
                sourceType: "sale_cancellation",
                sourceId: sale.id!,
                createdBy: numUserId,
              },
              tx,
            );
          }
        }
      }

      // 4. Void associated payments (only "completed" payments; "refunded" are preserved)
      await this.paymentRepo.voidBySaleId(sale.id!, tx);

      // 5. Customer ledger entries on cancellation
      if (ledgersEnabled && sale.customerId) {
        // 5a. Reverse ledger entries for every completed payment that was just voided.
        // This restores the customer's outstanding balance that was previously
        // reduced by those payments.
        const completedPayments = existingPayments.filter(
          (p) => p.status === "completed",
        );
        for (const payment of completedPayments) {
          const bal = await this.customerLedgerRepo.getLastBalanceSync(
            sale.customerId,
            tx,
          );
          await this.customerLedgerRepo.createSync(
            {
              customerId: sale.customerId,
              transactionType: "payment_reversal",
              amount: payment.amount,
              balanceAfter: bal + payment.amount,
              saleId: sale.id!,
              paymentId: payment.id,
              notes: `عكس الدفع - إلغاء فاتورة #${sale.invoiceNumber}`,
              createdBy: numUserId,
            },
            tx,
          );
        }

        // 5b. Cancellation entry to remove the remaining outstanding debt
        // (the unpaid portion that was never settled by a payment).
        if ((sale.remainingAmount ?? 0) > 0) {
          const balAfterPaymentReversals =
            await this.customerLedgerRepo.getLastBalanceSync(
              sale.customerId,
              tx,
            );
          await this.customerLedgerRepo.createSync(
            {
              customerId: sale.customerId,
              transactionType: "cancellation",
              amount: -sale.remainingAmount!,
              balanceAfter:
                balAfterPaymentReversals - sale.remainingAmount!,
              saleId: sale.id!,
              notes: `إلغاء فاتورة #${sale.invoiceNumber}`,
              createdBy: numUserId,
            },
            tx,
          );
        }
      }

      // 6. Mark sale as cancelled
      await this.saleRepo.updateStatus(input.saleId, "cancelled", tx);

      return { sale, depletionsRestored: depletions.length };
    });
  }

  async executeSideEffectsPhase(
    result: TCancelResult,
    userId: string,
  ): Promise<void> {
    if (!this.auditRepo) return;
    try {
      await this.auditRepo.create(
        new AuditEvent({
          userId: Number(userId),
          action: "cancel",
          entityType: "Sale",
          entityId: result.sale.id!,
          timestamp: new Date().toISOString(),
          changeDescription: `إلغاء فاتورة #${result.sale.invoiceNumber} (${result.depletionsRestored} batch depletions restored)`,
        }),
      );
    } catch {
      // Audit must not break committed cancellation.
    }
  }

  toEntity(_result: TCancelResult): void {
    return undefined;
  }
}
