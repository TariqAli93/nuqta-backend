import { ISaleRepository } from "../../interfaces/ISaleRepository.js";
import { IProductRepository } from "../../interfaces/IProductRepository.js";
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

export interface RefundReturnItem {
  saleItemId: number;
  quantity: number; // in sale unit
  returnToStock: boolean;
}

export interface RefundInput {
  saleId: number;
  amount: number;
  reason?: string;
  /** Per-line return control. If omitted or empty → refundOnly (no inventory). */
  returnItems?: RefundReturnItem[];
}

type TEntity = {
  saleId: number;
  refundedAmount: number;
  totalRefunded: number;
  newPaidAmount: number;
  newRemainingAmount: number;
  status: string;
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
    private productRepo?: IProductRepository,
  ) {
    super();
  }

  async executeCommitPhase(
    input: RefundInput,
    userId: string,
  ): Promise<TEntity> {
    const numUserId = Number(userId) || 0;

    // Pre-fetch settings outside tx (read-only)
    const settingsAccessor = new SettingsAccessor(this.settingsRepo);
    const accountingEnabled = await settingsAccessor.isAccountingEnabled();
    const ledgersEnabled = await settingsAccessor.isLedgersEnabled();

    return withTransaction(this.db, async (tx) => {
      // ── 1. Validate sale state ───────────────────────────────────
      const sale = await this.saleRepo.findById(input.saleId, tx);
      if (!sale) throw new NotFoundError("الفاتورة غير موجودة");
      if (sale.status === "cancelled")
        throw new InvalidStateError("لا يمكن استرداد فاتورة ملغية");
      if (sale.status === "refunded")
        throw new InvalidStateError("تم استرداد هذه الفاتورة بالكامل بالفعل");
      if (input.amount <= 0)
        throw new ValidationError("مبلغ الاسترداد يجب أن يكون أكبر من صفر");

      const refundableBalance =
        (sale.paidAmount ?? 0) - (sale.refundedAmount ?? 0);
      if (refundableBalance <= 0)
        throw new InvalidStateError("لا يوجد مبلغ مدفوع لاسترداده");
      if (input.amount > refundableBalance)
        throw new ValidationError("مبلغ الاسترداد أكبر من المبلغ المدفوع");

      // ── 2. Validate returnItems (if any) ─────────────────────────
      const returnItems = input.returnItems ?? [];
      const hasStockReturns = returnItems.some((ri) => ri.returnToStock);

      if (returnItems.length > 0) {
        // Check for duplicate saleItemIds
        const seenIds = new Set<number>();
        for (const ri of returnItems) {
          if (seenIds.has(ri.saleItemId))
            throw new ValidationError(
              `عنصر مكرر في قائمة الإرجاع: saleItemId ${ri.saleItemId}`,
            );
          seenIds.add(ri.saleItemId);

          if (ri.quantity <= 0)
            throw new ValidationError(
              `الكمية يجب أن تكون أكبر من صفر للعنصر ${ri.saleItemId}`,
            );

          // Validate saleItemId exists on this sale
          const saleItem = sale.items?.find((i) => i.id === ri.saleItemId);
          if (!saleItem)
            throw new ValidationError(
              `عنصر الفاتورة ${ri.saleItemId} غير موجود في هذه الفاتورة`,
            );

          // Validate return quantity (in sale units) does not exceed sold quantity
          if (ri.quantity > (saleItem.quantity ?? 0))
            throw new ValidationError(
              `كمية الإرجاع (${ri.quantity}) أكبر من الكمية المباعة (${saleItem.quantity}) للعنصر ${ri.saleItemId}`,
            );

          // Validate cumulative returned quantity (in base units) does not exceed sold base quantity.
          // This prevents over-return across multiple partial refunds on the same sale item.
          if (ri.returnToStock) {
            const unitFactor = saleItem.unitFactor ?? 1;
            const requestedBaseQty = ri.quantity * unitFactor;
            const soldBaseQty = saleItem.quantityBase ?? (saleItem.quantity * unitFactor);
            const alreadyReturnedBase = saleItem.returnedQuantityBase ?? 0;
            if (alreadyReturnedBase + requestedBaseQty > soldBaseQty)
              throw new ValidationError(
                `كمية الإرجاع المتراكمة (${alreadyReturnedBase + requestedBaseQty}) تتجاوز الكمية الأساسية المباعة (${soldBaseQty}) للعنصر ${ri.saleItemId}`,
              );
          }
        }
      }

      // ── 3. Inventory restoration (only for returnToStock=true lines) ─
      let cogsReversal = 0;

      if (hasStockReturns) {
        const depletions = await this.saleRepo.getItemDepletionsBySaleId(
          input.saleId,
          tx,
        );

        // Track running stock per product for accurate before/after snapshots
        const productStockMap = new Map<number, number>();

        for (const ri of returnItems) {
          // Skip lines that are refund-only (no stock return)
          if (!ri.returnToStock) continue;

          const saleItem = sale.items!.find((i) => i.id === ri.saleItemId)!;
          const productId = saleItem.productId!;
          const unitFactor = saleItem.unitFactor ?? 1;
          let qtyToReturn = ri.quantity * unitFactor;

          const itemDepletions = depletions.filter(
            (d) => d.saleItemId === ri.saleItemId,
          );
          if (itemDepletions.length === 0)
            throw new ValidationError(
              `لا توجد سجلات استنفاد مخزوني للعنصر ${ri.saleItemId} — لا يمكن إرجاع المخزون`,
            );

          // Fetch current stock once per product
          if (!productStockMap.has(productId)) {
            if (this.productRepo) {
              const product = await this.productRepo.findById(productId, tx);
              productStockMap.set(productId, product?.stock ?? 0);
              if (!product) {
                console.warn(
                  `[RefundSaleUseCase] Product ${productId} not found during refund stock lookup, using 0`,
                );
              }
            } else {
              productStockMap.set(productId, 0);
            }
          }

          // Restore batches in reverse depletion order (LIFO on depletions)
          // Track how many base-units we actually restored for this item so we
          // can update the sale_items.returned_quantity_base counter atomically.
          let actuallyRestoredBase = 0;
          for (const dep of [...itemDepletions].reverse()) {
            if (qtyToReturn <= 0) break;
            const returnQty = Math.min(qtyToReturn, dep.quantityBase);
            cogsReversal += returnQty * dep.costPerUnit;

            const stockBefore = productStockMap.get(productId)!;
            const stockAfter = stockBefore + returnQty;
            productStockMap.set(productId, stockAfter);

            await this.inventoryRepo.restoreBatchQty(
              dep.batchId,
              returnQty,
              tx,
            );
            await this.inventoryRepo.createMovement(
              {
                productId,
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
                notes: `إرجاع مخزون - استرداد فاتورة #${sale.invoiceNumber}`,
                createdBy: numUserId,
                stockBefore,
                stockAfter,
              },
              tx,
            );
            qtyToReturn -= returnQty;
            actuallyRestoredBase += returnQty;
          }

          // Persist the cumulative returned counter so subsequent refunds on
          // the same item can detect over-return before touching inventory.
          if (actuallyRestoredBase > 0) {
            await this.saleRepo.incrementItemReturnedQty(
              ri.saleItemId,
              actuallyRestoredBase,
              tx,
            );

            // Update products.stock cached counter so future stock checks
            // (CreateSaleUseCase fallback path, reconciliation) stay accurate.
            if (this.productRepo) {
              await this.productRepo.updateStock(productId, actuallyRestoredBase, tx);
            }
          }
        }
      }

      // ── 4. Negative payment record ──────────────────────────────
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

      const newRefundedAmount = (sale.refundedAmount ?? 0) + input.amount;

      const existingRemaining = sale.remainingAmount ?? 0;

      // Determine new invoice status
      const newStatus =
        newRefundedAmount >= (sale.paidAmount ?? 0)
          ? "refunded"
          : "partial_refund";

      await this.saleRepo.update(
        input.saleId,
        {
          refundedAmount: newRefundedAmount,
          remainingAmount: existingRemaining,
          status: newStatus,
          notes: sale.notes
            ? `${sale.notes}\nاسترداد: ${input.amount}${input.reason ? ` - ${input.reason}` : ""}${hasStockReturns ? " (مع إرجاع مخزون)" : " (استرداد مالي فقط)"}`
            : `استرداد: ${input.amount}${input.reason ? ` - ${input.reason}` : ""}${hasStockReturns ? " (مع إرجاع مخزون)" : " (استرداد مالي فقط)"}`,
        },
        tx,
      );

      // ── 6. Credit note journal entry (balanced) ─────────────────
      // Always creates the monetary side (revenue debit / cash or AR credit).
      // cogsReversal > 0 only when goods are physically returned (returnToStock=true).
      //
      // Tax split: when the original sale had VAT, the refund amount is split
      // proportionally into net-revenue reversal + VAT-output reversal:
      //   vatReversal  = round(refundAmount × (saleTax / saleTotal))
      //   netRevenue   = refundAmount - vatReversal
      // If sale has no tax (or total=0), vatReversal=0 and netRevenue=amount.
      //
      // Cash vs AR: credit-type sales must reduce AR (not Cash) on refund since
      // no cash was ever received for the credited portion.
      if (accountingEnabled) {
        const saleTax = sale.tax ?? 0;
        const saleTotal = sale.total ?? 0;
        const vatReversal =
          saleTax > 0 && saleTotal > 0
            ? Math.round(input.amount * (saleTax / saleTotal))
            : 0;
        const netRevenue = input.amount - vatReversal;

        // Resolve account codes from settings (honours custom chart-of-accounts).
        const [cashCode, arCode, revenueCode, vatCode, cogsCode, inventoryCode] =
          await Promise.all([
            settingsAccessor.getCashAccountCode(),
            settingsAccessor.getArAccountCode(),
            settingsAccessor.getSalesRevenueAccountCode(),
            settingsAccessor.getVatOutputAccountCode(),
            settingsAccessor.getCogsAccountCode(),
            settingsAccessor.getInventoryAccountCode(),
          ]);

        // Credit sales → reduce AR; cash/mixed → reduce Cash.
        const refundToAr = sale.paymentType === "credit";

        const [cashAcc, arAcc, revenueAcc, vatAcc, cogsAcc, inventoryAcc] =
          await Promise.all([
            !refundToAr
              ? this.accountingRepo.findAccountByCode(cashCode, tx)
              : Promise.resolve(null),
            refundToAr
              ? this.accountingRepo.findAccountByCode(arCode, tx)
              : Promise.resolve(null),
            this.accountingRepo.findAccountByCode(revenueCode, tx),
            vatReversal > 0
              ? this.accountingRepo.findAccountByCode(vatCode, tx)
              : Promise.resolve(null),
            cogsReversal > 0
              ? this.accountingRepo.findAccountByCode(cogsCode, tx)
              : Promise.resolve(null),
            cogsReversal > 0
              ? this.accountingRepo.findAccountByCode(inventoryCode, tx)
              : Promise.resolve(null),
          ]);

        // Guard: skip journal entry if any required account is missing.
        // Logs a warning rather than creating an unbalanced entry.
        const missingAccounts: string[] = [];
        if (!revenueAcc?.id) missingAccounts.push(revenueCode);
        if (refundToAr && !arAcc?.id) missingAccounts.push(arCode);
        if (!refundToAr && !cashAcc?.id) missingAccounts.push(cashCode);
        if (vatReversal > 0 && !vatAcc?.id) missingAccounts.push(vatCode);
        if (cogsReversal > 0 && !cogsAcc?.id) missingAccounts.push(cogsCode);
        if (cogsReversal > 0 && !inventoryAcc?.id)
          missingAccounts.push(inventoryCode);

        if (missingAccounts.length > 0) {
          console.warn(
            `[RefundSaleUseCase] Missing chart accounts (${missingAccounts.join(", ")}), skipping credit note journal for sale ${sale.id}`,
          );
        } else {
          await this.accountingRepo.createCreditNoteEntry(
            {
              saleId: sale.id!,
              amount: input.amount,
              netRevenue,
              vatAmount: vatReversal,
              cogsReversal,
              description: hasStockReturns
                ? `استرداد مع إرجاع مخزون - فاتورة #${sale.invoiceNumber}`
                : `استرداد مالي - فاتورة #${sale.invoiceNumber}`,
              createdBy: numUserId,
              // Pass explicit account IDs so the repo never falls back to
              // hardcoded codes and so it knows which side (cash vs AR) to credit.
              revenueAccountId: revenueAcc!.id!,
              cashAccountId: !refundToAr ? (cashAcc?.id ?? undefined) : undefined,
              arAccountId: refundToAr ? (arAcc?.id ?? undefined) : undefined,
              vatOutputAccountId: vatAcc?.id ?? undefined,
              cogsAccountId: cogsAcc?.id ?? undefined,
              inventoryAccountId: inventoryAcc?.id ?? undefined,
            },
            tx,
          );
        }
      }

      // ── 7. Customer ledger refund entry ─────────────────────────
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
        totalRefunded: newRefundedAmount,
        newPaidAmount: sale.paidAmount ?? 0,
        newRemainingAmount: existingRemaining,
        status: newStatus,
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
