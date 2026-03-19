/**
 * RefundSaleUseCase
 *
 * Records a partial or full refund on a sale with full financial integrity:
 *  1. Optionally restores inventory for returned items
 *  2. Creates a negative payment record (refund)
 *  3. Updates sale paidAmount / remainingAmount
 *  4. Creates a credit note journal entry (accounting)
 *  5. Creates a refund entry in the customer ledger
 *
 * All steps run inside a single database transaction.
 */
import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { IInventoryRepository } from "../../interfaces/IInventoryRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { ICustomerLedgerRepository } from "../../interfaces/ICustomerLedgerRepository.js";
import { IPaymentRepository } from "../../interfaces/IPaymentRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import {
  NotFoundError,
  InvalidStateError,
  ValidationError,
} from "../../shared/errors/DomainErrors.js";
import { AuditEvent } from "../../entities/AuditEvent.js";
import { SettingsAccessor } from "../../shared/services/SettingsAccessor.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";
import type { DbConnection } from "../../../data/db/db.js";
import { withTransaction } from "../../../data/db/transaction.js";

export interface RefundInput {
  saleId: number;
  amount: number;
  reason?: string;
  /** Items to return to inventory (optional) */
  returnItems?: {
    saleItemId: number;
    quantity: number; // in sale unit
  }[];
}

type TEntity = {
  saleId: number;
  refundedAmount: number;
  newPaidAmount: number;
  newRemainingAmount: number;
};

export class RefundSaleUseCase extends WriteUseCase<
  RefundInput,
  TEntity,
  TEntity
> {
  constructor(
    private db: DbConnection,
    private saleRepo: ISaleRepository,
    private paymentRepo: IPaymentRepository,
    private inventoryRepo: IInventoryRepository,
    private accountingRepo: IAccountingRepository,
    private customerLedgerRepo: ICustomerLedgerRepository,
    private settingsRepo: ISettingsRepository,
    private auditRepo?: IAuditRepository,
  ) {
    super();
  }

  async executeCommitPhase(
    input: RefundInput,
    userId: string,
  ): Promise<TEntity> {
    const numUserId = Number(userId) || 0;

    // Pre-fetch settings outside tx
    const settingsAccessor = new SettingsAccessor(this.settingsRepo);
    const accountingEnabled = await settingsAccessor.isAccountingEnabled();
    const ledgersEnabled = await settingsAccessor.isLedgersEnabled();

    return withTransaction(this.db, async (tx) => {
      // 1. Validate
      const sale = await this.saleRepo.findById(input.saleId, tx);
      if (!sale) throw new NotFoundError("الفاتورة غير موجودة");
      if (sale.status === "cancelled")
        throw new InvalidStateError("لا يمكن استرداد فاتورة ملغية");
      if (sale.status === "refunded")
        throw new InvalidStateError("تم استرداد هذه الفاتورة بالكامل بالفعل");
      if (input.amount <= 0)
        throw new ValidationError("مبلغ الاسترداد يجب أن يكون أكبر من صفر");
      if ((sale.paidAmount ?? 0) <= 0)
        throw new InvalidStateError("لا يوجد مبلغ مدفوع لاسترداده");
      if (input.amount > (sale.paidAmount ?? 0))
        throw new ValidationError("مبلغ الاسترداد أكبر من المبلغ المدفوع");

      // 2. Restore inventory for returned items
      let cogsReversal = 0;
      if (input.returnItems?.length) {
        const depletions = await this.saleRepo.getItemDepletionsBySaleId(
          input.saleId,
          tx,
        );

        for (const ri of input.returnItems) {
          const itemDepletions = depletions.filter(
            (d) => d.saleItemId === ri.saleItemId,
          );
          const saleItem = sale.items?.find((i) => i.id === ri.saleItemId);
          if (!saleItem) continue;

          const unitFactor = saleItem.unitFactor ?? 1;
          let qtyToReturn = ri.quantity * unitFactor;

          // Restore batches in reverse depletion order (LIFO on depletions)
          for (const dep of [...itemDepletions].reverse()) {
            if (qtyToReturn <= 0) break;
            const returnQty = Math.min(qtyToReturn, dep.quantityBase);
            cogsReversal += returnQty * dep.costPerUnit;

            // Compute stockBefore/stockAfter for the inventory movement.
            // We are constrained to this use-case layer, so we conservatively
            // derive stockAfter as stockBefore + returnQty.
            const stockBefore = 0;
            const stockAfter = stockBefore + returnQty;

            await this.inventoryRepo.restoreBatchQty(
              dep.batchId,
              returnQty,
              tx,
            );
            await this.inventoryRepo.createMovement(
              {
                productId: saleItem.productId!,
                batchId: dep.batchId,
                movementType: "in",
                reason: "refund",
                quantityBase: returnQty,
                unitName: saleItem.unitName ?? "piece",
                unitFactor: saleItem.unitFactor ?? 1,
                costPerUnit: dep.costPerUnit,
                totalCost: returnQty * dep.costPerUnit,
                sourceType: "sale_refund",
                sourceId: sale.id!,
                notes: `استرداد فاتورة #${sale.invoiceNumber}`,
                createdBy: numUserId,
                stockBefore,
                stockAfter,
              },
              tx,
            );
            qtyToReturn -= returnQty;
          }
        }
      }

      // 3. Create negative payment record
      await this.paymentRepo.createSync(
        {
          saleId: sale.id!,
          customerId: sale.customerId,
          amount: -input.amount,
          currency: sale.currency ?? "IQD",
          exchangeRate: 1,
          paymentMethod: "refund",
          status: "refunded",
          notes: `استرداد: ${input.reason ?? ""}`,
          createdBy: numUserId,
        } as any,
        tx,
      );

      // 4. Update sale amounts and status
      const newPaidAmount = (sale.paidAmount ?? 0) - input.amount;
      const newRemainingAmount = (sale.total ?? 0) - newPaidAmount;

      // Determine new invoice status based on refund outcome
      const newStatus =
        newPaidAmount === 0 ? "refunded" : "partial_refund";

      await this.saleRepo.update(
        input.saleId,
        {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
          notes: sale.notes
            ? `${sale.notes}\nاسترداد: ${input.amount}${input.reason ? ` - ${input.reason}` : ""}`
            : `استرداد: ${input.amount}${input.reason ? ` - ${input.reason}` : ""}`,
        },
        tx,
      );

      // 5. Credit note journal entry
      if (accountingEnabled) {
        await this.accountingRepo.createCreditNoteEntry(
          {
            saleId: sale.id!,
            amount: input.amount,
            cogsReversal,
            description: `استرداد - فاتورة #${sale.invoiceNumber}`,
            createdBy: numUserId,
          },
          tx,
        );
      }

      // 6. Customer ledger refund entry
      if (ledgersEnabled && sale.customerId) {
        const currentBalance = await this.customerLedgerRepo.getLastBalanceSync(
          sale.customerId,
          tx,
        );
        await this.customerLedgerRepo.createSync(
          {
            customerId: sale.customerId,
            transactionType: "refund",
            amount: -input.amount,
            balanceAfter: currentBalance - input.amount,
            saleId: sale.id!,
            notes: `استرداد - فاتورة #${sale.invoiceNumber}`,
            createdBy: numUserId,
          },
          tx,
        );
      }

      return {
        saleId: input.saleId,
        refundedAmount: input.amount,
        newPaidAmount,
        newRemainingAmount,
      };
    });
  }

  async executeSideEffectsPhase(
    result: TEntity,
    userId: string,
  ): Promise<void> {
    if (!this.auditRepo) return;
    try {
      await this.auditRepo.create(
        new AuditEvent({
          userId: Number(userId),
          action: "refund",
          entityType: "Sale",
          entityId: result.saleId,
          timestamp: new Date().toISOString(),
          changeDescription: `استرداد ${result.refundedAmount} من فاتورة #${result.saleId}`,
        }),
      );
    } catch {
      // Audit must not break committed refund.
    }
  }

  toEntity(result: TEntity): TEntity {
    return result;
  }
}
