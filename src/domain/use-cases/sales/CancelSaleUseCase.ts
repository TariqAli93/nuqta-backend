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

      // 2. Restore inventory for every batch-depletion
      const depletions = await this.saleRepo.getItemDepletionsBySaleId(
        input.saleId,
        tx,
      );

      for (const dep of depletions) {
        await this.inventoryRepo.restoreBatchQty(dep.batchId, dep.quantityBase, tx);
        await this.inventoryRepo.createMovement(
          {
            productId: dep.productId,
            batchId: dep.batchId,
            movementType: "in",
            reason: "cancellation",
            quantityBase: dep.quantityBase,
            costPerUnit: dep.costPerUnit,
            totalCost: dep.totalCost,
            sourceType: "sale_cancellation",
            sourceId: sale.id!,
            notes: `إلغاء فاتورة #${sale.invoiceNumber}`,
            createdBy: numUserId,
          },
          tx,
        );
      }

      // 3. Reversal journal entry
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

        // Payment reversal journal entry (if payments existed)
        if ((sale.paidAmount ?? 0) > 0) {
          await this.accountingRepo.createPaymentReversalEntry(
            {
              saleId: sale.id!,
              amount: sale.paidAmount!,
              description: `استرداد دفع - إلغاء فاتورة #${sale.invoiceNumber}`,
              createdBy: numUserId,
            },
            tx,
          );
        }
      }

      // 4. Void associated payments
      await this.paymentRepo.voidBySaleId(sale.id!, tx);

      // 5. Customer ledger cancellation entry
      if (ledgersEnabled && sale.customerId && (sale.remainingAmount ?? 0) > 0) {
        const currentBalance = await this.customerLedgerRepo.getLastBalanceSync(
          sale.customerId,
          tx,
        );
        await this.customerLedgerRepo.createSync(
          {
            customerId: sale.customerId,
            transactionType: "cancellation",
            amount: -(sale.remainingAmount!),
            balanceAfter: currentBalance - sale.remainingAmount!,
            saleId: sale.id!,
            notes: `إلغاء فاتورة #${sale.invoiceNumber}`,
            createdBy: numUserId,
          },
          tx,
        );
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
      await this.auditRepo.create({
        userId: Number(userId),
        action: "cancel",
        entityType: "Sale",
        entityId: String(result.sale.id),
        changeDescription: `إلغاء فاتورة #${result.sale.invoiceNumber} (${result.depletionsRestored} batch depletions restored)`,
      });
    } catch {
      // Audit must not break committed cancellation.
    }
  }

  toEntity(_result: TCancelResult): void {
    return undefined;
  }
}
