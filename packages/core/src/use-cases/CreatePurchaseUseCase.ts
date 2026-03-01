import { Purchase } from "../entities/Purchase.js";
import type { PaymentMethod } from "../entities/Payment.js";
import type { JournalLine } from "../entities/Accounting.js";
import { IPurchaseRepository } from "../interfaces/IPurchaseRepository.js";
import { ISupplierRepository } from "../interfaces/ISupplierRepository.js";
import { IPaymentRepository } from "../interfaces/IPaymentRepository.js";
import { ISupplierLedgerRepository } from "../interfaces/ISupplierLedgerRepository.js";
import { IAccountingRepository } from "../interfaces/IAccountingRepository.js";
import { ISettingsRepository } from "../interfaces/ISettingsRepository.js";
import { IAuditRepository } from "../interfaces/IAuditRepository.js";
import { AuditService } from "../services/AuditService.js";
import { ValidationError } from "../errors/DomainErrors.js";

const ACCT_CASH = "1001";
const ACCT_INVENTORY = "1200";
const ACCT_VAT_INPUT = "1300";
const AP_ACCOUNT_CODES = ["2001", "2100"];

export interface CreatePurchaseInput {
  invoiceNumber: string;
  supplierId: number;
  items: {
    productId: number;
    productName?: string;
    unitName?: string;
    unitFactor?: number;
    quantity: number;
    quantityBase?: number;
    unitCost: number;
    lineSubtotal?: number;
    discount?: number;
    batchId?: number;
    batchNumber?: string;
    expiryDate?: string;
  }[];
  discount?: number;
  tax?: number;
  paidAmount?: number;
  currency?: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  idempotencyKey?: string;
}

export interface CreatePurchaseCommitResult {
  createdPurchase: Purchase;
}

export class CreatePurchaseUseCase {
  private auditService?: AuditService;

  constructor(
    private purchaseRepository: IPurchaseRepository,
    private supplierRepository: ISupplierRepository,
    private paymentRepository: IPaymentRepository,
    private supplierLedgerRepository: ISupplierLedgerRepository,
    private accountingRepository: IAccountingRepository,
    private settingsRepository?: ISettingsRepository,
    auditRepo?: IAuditRepository,
  ) {
    if (auditRepo) {
      this.auditService = new AuditService(auditRepo as IAuditRepository);
    }
  }

  async executeCommitPhase(
    input: CreatePurchaseInput,
    userId: number,
  ): Promise<CreatePurchaseCommitResult> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError("Purchase must include at least one item");
    }

    if (
      input.discount !== undefined &&
      (!Number.isInteger(input.discount) || input.discount < 0)
    ) {
      throw new ValidationError(
        "Purchase discount must be a non-negative integer",
      );
    }
    if (
      input.tax !== undefined &&
      (!Number.isInteger(input.tax) || input.tax < 0)
    ) {
      throw new ValidationError("Purchase tax must be a non-negative integer");
    }
    if (
      input.paidAmount !== undefined &&
      (!Number.isInteger(input.paidAmount) || input.paidAmount < 0)
    ) {
      throw new ValidationError(
        "Purchase paid amount must be a non-negative integer",
      );
    }

    if (input.idempotencyKey) {
      const existing = await this.purchaseRepository.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existing) {
        return { createdPurchase: existing };
      }
    }

    const subtotal = input.items.reduce((sum, item) => {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new ValidationError("Item quantity must be a positive integer", {
          productId: item.productId,
          quantity: item.quantity,
        });
      }
      if (!Number.isInteger(item.unitCost) || item.unitCost < 0) {
        throw new ValidationError(
          "Item unit cost must be a non-negative integer",
          {
            productId: item.productId,
            unitCost: item.unitCost,
          },
        );
      }
      if (
        item.discount !== undefined &&
        (!Number.isInteger(item.discount) || item.discount < 0)
      ) {
        throw new ValidationError(
          "Item discount must be a non-negative integer",
          {
            productId: item.productId,
            discount: item.discount,
          },
        );
      }
      const qty = item.quantity;
      const lineSubtotal =
        item.lineSubtotal ?? qty * item.unitCost - (item.discount || 0);
      if (!Number.isInteger(lineSubtotal) || lineSubtotal < 0) {
        throw new ValidationError(
          "Item line subtotal must be a non-negative integer",
          {
            productId: item.productId,
            lineSubtotal,
          },
        );
      }
      return sum + lineSubtotal;
    }, 0);

    const discount = input.discount || 0;
    const tax = input.tax || 0;
    const total = subtotal - discount + tax;
    const paidAmount = Math.max(0, input.paidAmount || 0);
    const remainingAmount = Math.max(0, total - paidAmount);
    const now = new Date();

    const purchase: Purchase = {
      invoiceNumber: input.invoiceNumber,
      supplierId: input.supplierId,
      subtotal,
      discount,
      tax,
      total,
      paidAmount,
      remainingAmount,
      currency: input.currency || "IQD",
      exchangeRate: 1,
      status: remainingAmount <= 0 ? "completed" : "pending",
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      items: input.items.map((item) => {
        const quantityBase =
          item.quantityBase || item.quantity * (item.unitFactor || 1);
        if (!Number.isInteger(quantityBase) || quantityBase <= 0) {
          throw new ValidationError(
            "Item quantityBase must be a positive integer",
            {
              productId: item.productId,
              quantityBase,
            },
          );
        }
        return {
          productId: item.productId,
          productName: item.productName || `Product #${item.productId}`,
          unitName: item.unitName || "piece",
          unitFactor: item.unitFactor || 1,
          quantity: item.quantity,
          quantityBase,
          unitCost: item.unitCost,
          lineSubtotal:
            item.lineSubtotal ??
            item.quantity * item.unitCost - (item.discount || 0),
          discount: item.discount || 0,
          batchId: item.batchId,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate || null,
        };
      }),
    };

    const createdPurchase = await this.purchaseRepository.createSync(purchase);

    if (paidAmount > 0) {
      await this.paymentRepository.createSync({
        purchaseId: createdPurchase.id,
        supplierId: createdPurchase.supplierId,
        amount: paidAmount,
        currency: createdPurchase.currency || "IQD",
        exchangeRate: 1,
        paymentMethod: input.paymentMethod || "cash",
        referenceNumber: input.referenceNumber,
        status: "completed",
        paymentDate: now,
        createdAt: now,
        createdBy: userId,
        // Keep payment idempotency deterministic and unique per purchase write.
        idempotencyKey: input.idempotencyKey
          ? `${input.idempotencyKey}:payment:initial`
          : undefined,
      } as any);
    }

    if ((await this.isLedgersEnabled()) && remainingAmount > 0) {
      const balanceBefore =
        await this.supplierLedgerRepository.getLastBalanceSync(
          createdPurchase.supplierId,
        );
      await this.supplierLedgerRepository.createSync({
        supplierId: createdPurchase.supplierId,
        transactionType: "invoice",
        amount: remainingAmount,
        balanceAfter: balanceBefore + remainingAmount,
        purchaseId: createdPurchase.id,
        notes: `Purchase #${createdPurchase.invoiceNumber}`,
        createdBy: userId,
      });
    }

    if (await this.isAccountingEnabled()) {
      await this.createPurchaseJournalEntry(
        createdPurchase,
        paidAmount,
        remainingAmount,
        userId,
      );
    }

    return { createdPurchase };
  }

  private async createPurchaseJournalEntry(
    purchase: Purchase,
    paidAmount: number,
    remainingAmount: number,
    userId: number,
  ): Promise<void> {
    const inventoryAcct =
      await this.accountingRepository.findAccountByCode(ACCT_INVENTORY);
    const cashAcct =
      await this.accountingRepository.findAccountByCode(ACCT_CASH);
    let apAcct = null;
    for (const code of AP_ACCOUNT_CODES) {
      apAcct = await this.accountingRepository.findAccountByCode(code);
      if (apAcct) break;
    }
    const vatInputAcct =
      purchase.tax > 0
        ? await this.accountingRepository.findAccountByCode(ACCT_VAT_INPUT)
        : null;

    if (!inventoryAcct?.id) {
      console.warn(
        "[CreatePurchaseUseCase] Missing inventory account, skipping journal entry",
      );
      return;
    }
    if (purchase.tax > 0 && !vatInputAcct?.id) {
      console.warn(
        "[CreatePurchaseUseCase] Missing VAT Input account, skipping journal entry",
      );
      return;
    }

    const lines: JournalLine[] = [];

    // Inventory debit: total minus tax (net cost)
    const netInventoryCost =
      purchase.tax > 0 ? purchase.total - purchase.tax : purchase.total;
    lines.push({
      accountId: inventoryAcct.id,
      debit: netInventoryCost,
      credit: 0,
      description: "Inventory received",
    });

    // VAT Input debit (tax paid on purchase, if any)
    if (purchase.tax > 0 && vatInputAcct?.id) {
      lines.push({
        accountId: vatInputAcct.id,
        debit: purchase.tax,
        credit: 0,
        description: "ضريبة المدخلات",
      });
    }

    if (paidAmount > 0) {
      if (!cashAcct?.id) {
        console.warn(
          "[CreatePurchaseUseCase] Missing cash account, skipping journal entry",
        );
        return;
      }
      lines.push({
        accountId: cashAcct.id,
        debit: 0,
        credit: paidAmount,
        description: "Cash payment",
      });
    }

    if (remainingAmount > 0) {
      if (!apAcct?.id) {
        console.warn(
          "[CreatePurchaseUseCase] Missing AP account, skipping journal entry",
        );
        return;
      }
      lines.push({
        accountId: apAcct.id,
        debit: 0,
        credit: remainingAmount,
        description: "Accounts payable",
      });
    }

    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    if (totalDebit !== totalCredit) {
      console.warn(
        `[CreatePurchaseUseCase] Unbalanced journal skipped for purchase ${purchase.id}: ${totalDebit} != ${totalCredit}`,
      );
      return;
    }

    await this.accountingRepository.createJournalEntrySync({
      entryNumber: `JE-PUR-${purchase.id || Date.now()}`,
      entryDate: new Date(),
      description: `Purchase #${purchase.invoiceNumber}`,
      sourceType: "purchase",
      sourceId: purchase.id,
      isPosted: false,
      isReversed: false,
      totalAmount: purchase.total,
      currency: purchase.currency || "IQD",
      createdBy: userId,
      lines,
    });
  }

  async execute(input: CreatePurchaseInput, userId = 1): Promise<Purchase> {
    const result = await this.executeCommitPhase(input, userId);
    await this.executeSideEffectsPhase(result, userId);
    return result.createdPurchase;
  }

  async executeSideEffectsPhase(
    result: CreatePurchaseCommitResult,
    userId: number,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logCreate(
        userId,
        "Purchase",
        result.createdPurchase.id!,
        {
          invoiceNumber: result.createdPurchase.invoiceNumber,
          total: result.createdPurchase.total,
          supplierId: result.createdPurchase.supplierId,
          itemCount: result.createdPurchase.items?.length,
        },
        `Purchase #${result.createdPurchase.invoiceNumber} created`,
      );
    } catch (error) {
      // Audit must not break committed business writes.
      console.warn("Audit logging failed for purchase creation:", error);
    }
  }

  private async isAccountingEnabled(): Promise<boolean> {
    if (!this.settingsRepository) return true;
    const value =
      (await this.settingsRepository.get("accounting.enabled")) ??
      (await this.settingsRepository.get("modules.accounting.enabled"));
    return value !== "false";
  }

  private async isLedgersEnabled(): Promise<boolean> {
    if (!this.settingsRepository) return true;
    const value =
      (await this.settingsRepository.get("ledgers.enabled")) ??
      (await this.settingsRepository.get("modules.ledgers.enabled"));
    return value !== "false";
  }
}
