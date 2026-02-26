import { ISaleRepository } from "../interfaces/ISaleRepository.js";
import { IProductRepository } from "../interfaces/IProductRepository.js";
import { ICustomerRepository } from "../interfaces/ICustomerRepository.js";
import { ISettingsRepository } from "../interfaces/ISettingsRepository.js";
import { IPaymentRepository } from "../interfaces/IPaymentRepository.js";
import { IInventoryRepository } from "../interfaces/IInventoryRepository.js";
import { IAccountingRepository } from "../interfaces/IAccountingRepository.js";
import { ICustomerLedgerRepository } from "../interfaces/ICustomerLedgerRepository.js";
import { IAuditRepository } from "../interfaces/IAuditRepository.js";
import { Sale } from "../entities/Sale.js";
import type { PaymentMethod } from "../entities/Payment.js";
import type { JournalLine } from "../entities/Accounting.js";
import type {
  IFifoDepletionService,
  BatchDepletion,
} from "../services/FifoDepletionService.js";
import {
  ValidationError,
  NotFoundError,
  InsufficientStockError,
  ConflictError,
} from "../errors/DomainErrors.js";
import { AuditService } from "../services/AuditService.js";
import {
  generateInvoiceNumber,
  calculateSaleTotals,
  roundByCurrency,
} from "../utils/helpers.js";

// ─── Account code constants (see seed data chart of accounts) ─────────
const ACCT_CASH = "1001"; // الصندوق
const ACCT_AR = "1100"; // ذمم العملاء
const ACCT_REVENUE = "4001"; // إيرادات المبيعات
const ACCT_COGS = "5001"; // تكلفة البضاعة
const ACCT_INVENTORY = "1200"; // المخزون
const ACCT_VAT_OUTPUT = "2200"; // ضريبة المخرجات

function logDevDiagnostics(event: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  try {
    console.log(JSON.stringify({ scope: "CreateSaleUseCase", ...event }));
  } catch {
    // Diagnostics logging must never break the sale flow.
  }
}

export interface CreateSaleInput {
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    discount?: number;
    unitName?: string;
    unitFactor?: number;
    batchId?: number;
  }[];
  customerId?: number;
  discount?: number;
  tax?: number;
  paymentType: "cash" | "credit" | "mixed";
  paidAmount?: number;
  currency?: string;
  notes?: string;
  interestRate?: number;
  interestRateBps?: number;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  idempotencyKey?: string;
}

export interface CreateSaleCommitResult {
  createdSale: Sale;
  userId: number;
  currency: string;
}

type CreateSaleDiagnostics = {
  inventoryMovementsCreated: number;
  fifoUsed: boolean;
  paymentCreated: { created: boolean; reason: string };
  journalCreated: {
    created: boolean;
    reason: string;
    missingAccountCodes?: string[];
  };
  customerLedgerCreated: { created: boolean; reason: string };
};

export class CreateSaleUseCase {
  private auditService: AuditService;

  constructor(
    private saleRepo: ISaleRepository,
    private productRepo: IProductRepository,
    private customerRepo: ICustomerRepository,
    private settingsRepo: ISettingsRepository,
    private paymentRepo: IPaymentRepository,
    private inventoryRepo: IInventoryRepository,
    private accountingRepo: IAccountingRepository,
    private customerLedgerRepo: ICustomerLedgerRepository,
    auditRepo?: IAuditRepository,
    private fifoService?: IFifoDepletionService,
  ) {
    this.auditService = new AuditService(auditRepo as IAuditRepository);
  }

  async executeCommitPhase(
    input: CreateSaleInput,
    userId: number,
  ): Promise<CreateSaleCommitResult> {
    const diagnostics: CreateSaleDiagnostics = {
      inventoryMovementsCreated: 0,
      fifoUsed: !!this.fifoService,
      paymentCreated: { created: false, reason: "not-executed" },
      journalCreated: { created: false, reason: "not-executed" },
      customerLedgerCreated: { created: false, reason: "not-executed" },
    };
    // ── Step 1: Idempotency check ───────────────────────────────
    if (input.idempotencyKey) {
      const existing = await this.saleRepo.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existing) {
        const currencySettings = await this.settingsRepo.getCurrencySettings();
        diagnostics.paymentCreated = {
          created: false,
          reason: "idempotency-hit",
        };
        diagnostics.journalCreated = {
          created: false,
          reason: "idempotency-hit",
        };
        diagnostics.customerLedgerCreated = {
          created: false,
          reason: "idempotency-hit",
        };
        logDevDiagnostics({
          phase: "commit",
          idempotencyKey: input.idempotencyKey,
          saleId: existing.id,
          ...diagnostics,
        });
        return {
          createdSale: existing,
          userId,
          currency: input.currency || currencySettings.defaultCurrency,
        };
      }
    }

    // ── Step 2: Validate items ──────────────────────────────────
    if (!input.items || input.items.length === 0) {
      throw new ValidationError("Sale must have at least one item");
    }

    // Payment-method-specific validation
    if (input.paymentMethod === "card" && !input.referenceNumber?.trim()) {
      throw new ValidationError("Card payments require a reference number");
    }

    if (input.paymentMethod === "credit" && !input.customerId) {
      throw new ValidationError("Credit/debt payments require a customer");
    }

    if (
      input.discount !== undefined &&
      (!Number.isInteger(input.discount) || input.discount < 0)
    ) {
      throw new ValidationError(
        "Sale discount must be a non-negative integer amount",
      );
    }
    if (
      input.tax !== undefined &&
      (!Number.isInteger(input.tax) || input.tax < 0)
    ) {
      throw new ValidationError(
        "Sale tax must be a non-negative integer amount",
      );
    }
    if (
      input.paidAmount !== undefined &&
      (!Number.isInteger(input.paidAmount) || input.paidAmount < 0)
    ) {
      throw new ValidationError(
        "Paid amount must be a non-negative integer amount",
      );
    }

    const currencySettings = await this.settingsRepo.getCurrencySettings();
    const currency = input.currency || currencySettings.defaultCurrency;

    // ── Step 3: Validate products, stock, batches & build items ─
    const saleItems: {
      productId: number;
      productName: string;
      quantity: number;
      unitName: string;
      unitFactor: number;
      quantityBase: number;
      batchId?: number;
      unitPrice: number;
      discount: number;
      subtotal: number;
      costPrice: number;
      fallbackCostTotal: number;
    }[] = [];

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new ValidationError("Item quantity must be a positive integer", {
          productId: item.productId,
          quantity: item.quantity,
        });
      }
      if (!Number.isInteger(item.unitPrice) || item.unitPrice < 0) {
        throw new ValidationError(
          "Item unit price must be a non-negative integer amount",
          {
            productId: item.productId,
            unitPrice: item.unitPrice,
          },
        );
      }
      if (
        item.discount !== undefined &&
        (!Number.isInteger(item.discount) || item.discount < 0)
      ) {
        throw new ValidationError(
          "Item discount must be a non-negative integer amount",
          {
            productId: item.productId,
            discount: item.discount,
          },
        );
      }

      const product = await this.productRepo.findById(item.productId);
      if (!product) {
        throw new NotFoundError(`Product ${item.productId} not found`, {
          productId: item.productId,
        });
      }

      if (!product.id) {
        throw new Error(`Product ${product.name} has no ID`);
      }

      // ── Resolve unit (server-authoritative) ─────────────────────
      const configuredUnits = await this.productRepo.findUnitsByProductId(
        product.id,
      );
      let unitName: string;
      let unitFactor: number;
      let unitPrice: number;

      if (configuredUnits.length > 0 && item.unitName) {
        // Product has configured units AND item specifies one → validate
        const matchedUnit = configuredUnits.find(
          (u) => u.unitName === item.unitName && u.isActive,
        );
        if (!matchedUnit) {
          throw new ValidationError(
            `Unit "${item.unitName}" not found or inactive for product "${product.name}"`,
            { productId: product.id, unitName: item.unitName },
          );
        }
        unitName = matchedUnit.unitName;
        unitFactor = matchedUnit.factorToBase;
        // Use stored sellingPrice if available; else fall back to item input
        unitPrice =
          matchedUnit.sellingPrice != null
            ? matchedUnit.sellingPrice
            : item.unitPrice;
      } else if (configuredUnits.length > 0 && !item.unitName) {
        // Product has units but none specified → use default unit
        const defaultUnit =
          configuredUnits.find((u) => u.isDefault && u.isActive) ||
          configuredUnits.find((u) => u.isActive);
        if (defaultUnit) {
          unitName = defaultUnit.unitName;
          unitFactor = defaultUnit.factorToBase;
          unitPrice =
            defaultUnit.sellingPrice != null
              ? defaultUnit.sellingPrice
              : item.unitPrice;
        } else {
          // All units inactive; fall back to product-level
          unitName = item.unitName || "piece";
          unitFactor = item.unitFactor || 1;
          unitPrice = item.unitPrice;
        }
      } else {
        // No configured units → backward-compatible fallback
        unitName = item.unitName || "piece";
        unitFactor = item.unitFactor || 1;
        unitPrice = item.unitPrice;
      }

      const quantityBase = item.quantity * unitFactor;
      if (!Number.isInteger(quantityBase) || quantityBase <= 0) {
        throw new ValidationError("quantityBase must be a positive integer", {
          productId: product.id,
          quantityBase,
          quantity: item.quantity,
          unitFactor,
        });
      }

      // Stock check — use FIFO service if available, else fall back to cached stock
      if (this.fifoService) {
        const batchStock = await this.fifoService.getAvailableStock(product.id);
        if (batchStock < quantityBase) {
          throw new InsufficientStockError(
            `Insufficient batch stock for ${product.name}`,
            {
              productId: product.id,
              productName: product.name,
              available: batchStock,
              requested: quantityBase,
            },
          );
        }
      } else {
        if ((product.stock || 0) < quantityBase) {
          throw new InsufficientStockError(
            `Insufficient stock for ${product.name}`,
            {
              productId: product.id,
              productName: product.name,
              available: product.stock || 0,
              requested: quantityBase,
            },
          );
        }
      }

      // COGS will be calculated from FIFO batch costs if available
      const fallbackCostTotal = quantityBase * product.costPrice;

      saleItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitName,
        unitFactor,
        quantityBase,
        batchId: item.batchId,
        unitPrice,
        discount: item.discount || 0,
        subtotal:
          item.quantity * unitPrice - (item.discount || 0) * item.quantity,
        costPrice: product.costPrice,
        fallbackCostTotal,
      });
    }

    // ── Step 4: Calculate totals ────────────────────────────────
    const totals = calculateSaleTotals(input.items, input.discount, input.tax);

    let interestAmount = 0;
    let finalTotal = totals.total;
    const interestRateBps = (() => {
      if (input.interestRateBps !== undefined) {
        if (
          !Number.isInteger(input.interestRateBps) ||
          input.interestRateBps < 0
        ) {
          throw new ValidationError(
            "interestRateBps must be a non-negative integer",
          );
        }
        return input.interestRateBps;
      }
      if (input.interestRate === undefined) return 0;
      if (!Number.isInteger(input.interestRate) || input.interestRate < 0) {
        throw new ValidationError(
          "Legacy interestRate must be a non-negative integer percent",
        );
      }
      return input.interestRate * 100;
    })();

    if (
      (input.paymentType === "credit" || input.paymentType === "mixed") &&
      interestRateBps > 0
    ) {
      const numerator = totals.total * interestRateBps;
      if (numerator % 10_000 !== 0) {
        throw new ValidationError(
          "Interest configuration produces fractional IQD values. Use compatible basis points.",
        );
      }
      interestAmount = numerator / 10_000;
      finalTotal = totals.total + interestAmount;
    }

    finalTotal = roundByCurrency(finalTotal, currency);
    const paidAmount = roundByCurrency(input.paidAmount || 0, currency);
    let remainingAmount = Math.max(0, finalTotal - paidAmount);
    const threshold = currency === "IQD" ? 0 : 0.01;
    if (remainingAmount < threshold) {
      remainingAmount = 0;
    } else {
      remainingAmount = roundByCurrency(remainingAmount, currency);
    }

    // ── Step 5: Create sale record ──────────────────────────────
    const saleData: Sale = {
      invoiceNumber: generateInvoiceNumber(),
      customerId: input.customerId,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: finalTotal,
      currency,
      exchangeRate: 1,
      paymentType: input.paymentType,
      paidAmount,
      remainingAmount,
      status: remainingAmount <= 0 ? "completed" : "pending",
      notes: input.notes,
      interestRate: interestRateBps,
      interestAmount: roundByCurrency(interestAmount, currency),
      idempotencyKey: input.idempotencyKey,
      createdBy: userId,
      items: saleItems.map((si) => ({
        productId: si.productId,
        productName: si.productName,
        quantity: si.quantity,
        unitName: si.unitName,
        unitFactor: si.unitFactor,
        quantityBase: si.quantityBase,
        batchId: si.batchId,
        unitPrice: si.unitPrice,
        discount: si.discount,
        subtotal: si.subtotal,
      })),
      createdAt: new Date().toISOString(),
    };

    const createdSale = await this.saleRepo.create(saleData);
    const persistedItems = createdSale.items || [];
    if (persistedItems.length !== saleItems.length) {
      throw new ConflictError(
        "Persisted sale items do not match requested sale items",
        {
          saleId: createdSale.id,
          expectedItems: saleItems.length,
          persistedItems: persistedItems.length,
        },
      );
    }

    // ── Step 6 & 7: FIFO batch depletion + inventory movements ──
    let totalCOGS = 0;

    for (const [index, item] of saleItems.entries()) {
      const persistedItem = persistedItems[index];
      const saleItemId = persistedItem?.id;
      if (!saleItemId) {
        throw new ConflictError("Persisted sale item is missing id", {
          saleId: createdSale.id,
          index,
        });
      }

      const currentProduct = (await this.productRepo.findById(item.productId))!;
      const stockBefore = currentProduct.stock || 0;

      if (this.fifoService) {
        // ── FIFO path: deplete from oldest batches, calculate real COGS ──
        const fifoResult = await this.fifoService.deplete(
          item.productId,
          item.quantityBase,
        );
        totalCOGS += fifoResult.totalCost;
        await this.saleRepo.createItemDepletions(
          fifoResult.depletions.map((depletion) => ({
            saleId: createdSale.id!,
            saleItemId,
            productId: item.productId,
            batchId: depletion.batchId,
            quantityBase: depletion.quantity,
            costPerUnit: depletion.costPerUnit,
            totalCost: depletion.totalCost,
          })),
        );

        // Create one inventory movement per batch depletion for full traceability
        let runningStock = stockBefore;
        for (const depletion of fifoResult.depletions) {
          const newStock = runningStock - depletion.quantity;
          await this.inventoryRepo.createMovementSync({
            productId: item.productId,
            batchId: depletion.batchId,
            movementType: "out",
            reason: "sale",
            quantityBase: depletion.quantity,
            unitName: item.unitName,
            unitFactor: item.unitFactor,
            stockBefore: runningStock,
            stockAfter: newStock,
            costPerUnit: depletion.costPerUnit,
            totalCost: depletion.totalCost,
            sourceType: "sale",
            sourceId: createdSale.id,
            notes: `Sale #${createdSale.invoiceNumber} (batch ${depletion.batchId})`,
            createdBy: userId,
          });
          diagnostics.inventoryMovementsCreated += 1;
          runningStock = newStock;
        }

        // Update products.stock cache (one atomic update per product)
        await this.productRepo.updateStock(item.productId, -item.quantityBase);
      } else {
        // ── Legacy path: no FIFO, flat stock deduction ──
        const stockAfter = stockBefore - item.quantityBase;
        totalCOGS += item.fallbackCostTotal;

        await this.inventoryRepo.createMovementSync({
          productId: item.productId,
          batchId: item.batchId,
          movementType: "out",
          reason: "sale",
          quantityBase: item.quantityBase,
          unitName: item.unitName,
          unitFactor: item.unitFactor,
          stockBefore,
          stockAfter,
          costPerUnit: item.costPrice,
          totalCost: item.fallbackCostTotal,
          sourceType: "sale",
          sourceId: createdSale.id,
          notes: `Sale #${createdSale.invoiceNumber}`,
          createdBy: userId,
        });
        diagnostics.inventoryMovementsCreated += 1;

        await this.productRepo.updateStock(item.productId, -item.quantityBase);

        if (item.batchId) {
          await this.productRepo.updateBatchStock(
            item.batchId,
            -item.quantityBase,
          );
          await this.saleRepo.createItemDepletions([
            {
              saleId: createdSale.id!,
              saleItemId,
              productId: item.productId,
              batchId: item.batchId,
              quantityBase: item.quantityBase,
              costPerUnit: item.costPrice,
              totalCost: item.fallbackCostTotal,
            },
          ]);
        }
      }
    }

    // ── Step 8: Create payment ──────────────────────────────────
    if (paidAmount > 0) {
      await this.paymentRepo.createSync({
        saleId: createdSale.id,
        customerId: input.customerId,
        amount: paidAmount,
        currency,
        exchangeRate: 1,
        paymentMethod: input.paymentMethod || "cash",
        referenceNumber: input.referenceNumber,
        idempotencyKey: input.idempotencyKey
          ? `${input.idempotencyKey}:payment:initial`
          : undefined,
        createdBy: userId,
      });
      diagnostics.paymentCreated = { created: true, reason: "paidAmount>0" };
    } else {
      diagnostics.paymentCreated = { created: false, reason: "paidAmount<=0" };
    }

    // ── Step 9: Accounting journal entry ─────────────────────────
    const accountingEnabled = await this.isAccountingEnabled();
    const ledgersEnabled = await this.isLedgersEnabled();
    diagnostics.journalCreated = accountingEnabled
      ? await this.createSaleJournalEntry(
          createdSale,
          totalCOGS,
          paidAmount,
          remainingAmount,
          currency,
          userId,
        )
      : { created: false, reason: "accounting-disabled" };

    // ── Step 10: Customer ledger + debt ──────────────────────────
    if (!ledgersEnabled) {
      diagnostics.customerLedgerCreated = {
        created: false,
        reason: "ledgers-disabled",
      };
    } else if (input.customerId && remainingAmount > 0) {
      const currentDebt = await this.customerLedgerRepo.getLastBalanceSync(
        input.customerId,
      );
      const newBalance = currentDebt + remainingAmount;

      await this.customerLedgerRepo.createSync({
        customerId: input.customerId,
        transactionType: "invoice",
        amount: remainingAmount,
        balanceAfter: newBalance,
        saleId: createdSale.id,
        notes: `Sale #${createdSale.invoiceNumber}`,
        createdBy: userId,
      });
      diagnostics.customerLedgerCreated = {
        created: true,
        reason: "remainingAmount>0",
      };
    } else if (!input.customerId) {
      diagnostics.customerLedgerCreated = {
        created: false,
        reason: "missing-customerId",
      };
    } else {
      diagnostics.customerLedgerCreated = {
        created: false,
        reason: "remainingAmount<=0",
      };
    }

    createdSale.cogs = totalCOGS;
    createdSale.totalCogs = totalCOGS;
    createdSale.profit = createdSale.total - totalCOGS;
    createdSale.marginBps =
      createdSale.total > 0
        ? Math.trunc((createdSale.profit * 10_000) / createdSale.total)
        : 0;

    logDevDiagnostics({
      phase: "commit",
      idempotencyKey: input.idempotencyKey,
      saleId: createdSale.id,
      ...diagnostics,
    });

    return {
      createdSale,
      userId,
      currency,
    };
  }

  /**
   * Creates a double-entry journal entry for the sale.
   * Gracefully skips if chart of accounts is not set up.
   */
  private async createSaleJournalEntry(
    sale: Sale,
    totalCOGS: number,
    paidAmount: number,
    remainingAmount: number,
    currency: string,
    userId: number,
  ): Promise<{
    created: boolean;
    reason: string;
    missingAccountCodes?: string[];
  }> {
    // Look up account IDs by code
    const cashAcct = await this.accountingRepo.findAccountByCode(ACCT_CASH);
    const arAcct = await this.accountingRepo.findAccountByCode(ACCT_AR);
    const revenueAcct =
      await this.accountingRepo.findAccountByCode(ACCT_REVENUE);
    const cogsAcct = await this.accountingRepo.findAccountByCode(ACCT_COGS);
    const inventoryAcct =
      await this.accountingRepo.findAccountByCode(ACCT_INVENTORY);
    const vatOutputAcct =
      sale.tax > 0
        ? await this.accountingRepo.findAccountByCode(ACCT_VAT_OUTPUT)
        : null;

    // If required accounts are missing, skip journal entry creation
    const missing: string[] = [];
    if (!revenueAcct?.id) missing.push(ACCT_REVENUE);
    if (paidAmount > 0 && !cashAcct?.id) missing.push(ACCT_CASH);
    if (remainingAmount > 0 && !arAcct?.id) missing.push(ACCT_AR);
    if (totalCOGS > 0) {
      if (!cogsAcct?.id) missing.push(ACCT_COGS);
      if (!inventoryAcct?.id) missing.push(ACCT_INVENTORY);
    }
    if (sale.tax > 0 && !vatOutputAcct?.id) missing.push(ACCT_VAT_OUTPUT);

    if (missing.length > 0) {
      console.warn(
        `[CreateSaleUseCase] Missing chart accounts (${missing.join(", ")}), skipping journal entry`,
      );
      return {
        created: false,
        reason: "missing-chart-accounts",
        missingAccountCodes: missing,
      };
    }

    const lines: JournalLine[] = [];
    const revenueAccountId = revenueAcct!.id!;

    // Revenue entry: net amount (total minus tax)
    const netRevenue = sale.tax > 0 ? sale.total - sale.tax : sale.total;
    lines.push({
      accountId: revenueAccountId,
      debit: 0,
      credit: netRevenue,
      description: "إيرادات المبيعات",
    });

    // VAT Output (tax collected, if any)
    if (sale.tax > 0 && vatOutputAcct?.id) {
      lines.push({
        accountId: vatOutputAcct.id,
        debit: 0,
        credit: sale.tax,
        description: "ضريبة المخرجات",
      });
    }

    // Cash received (if any)
    if (paidAmount > 0 && cashAcct?.id) {
      lines.push({
        accountId: cashAcct.id,
        debit: paidAmount,
        credit: 0,
        description: "تحصيل نقدي",
      });
    }

    // Accounts receivable (if credit portion)
    if (remainingAmount > 0 && arAcct?.id) {
      lines.push({
        accountId: arAcct.id,
        debit: remainingAmount,
        credit: 0,
        description: "ذمم العملاء",
      });
    }

    // COGS / Inventory entries (if accounts exist and COGS > 0)
    if (totalCOGS > 0 && cogsAcct?.id && inventoryAcct?.id) {
      lines.push({
        accountId: cogsAcct.id,
        debit: totalCOGS,
        credit: 0,
        description: "تكلفة البضاعة المباعة",
      });

      lines.push({
        accountId: inventoryAcct.id,
        debit: 0,
        credit: totalCOGS,
        description: "تخفيض المخزون",
      });
    }

    const entryNumber = `JE-SALE-${sale.id || Date.now()}`;

    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce(
      (sum, line) => sum + (line.credit || 0),
      0,
    );
    if (totalDebit !== totalCredit) {
      console.warn(
        `[CreateSaleUseCase] Unbalanced journal skipped for sale ${sale.id}: ${totalDebit} != ${totalCredit}`,
      );
      return {
        created: false,
        reason: `unbalanced-journal:${totalDebit}!=${totalCredit}`,
      };
    }

    await this.accountingRepo.createJournalEntrySync({
      entryNumber,
      entryDate: new Date().toISOString(),
      description: `Sale #${sale.invoiceNumber}`,
      sourceType: "sale",
      sourceId: sale.id,
      isPosted: false,
      isReversed: false,
      totalAmount: sale.total,
      currency,
      createdBy: userId,
      lines,
    });
    return { created: true, reason: "created" };
  }

  private async isAccountingEnabled(): Promise<boolean> {
    const value =
      (await this.settingsRepo.get("accounting.enabled")) ??
      (await this.settingsRepo.get("modules.accounting.enabled"));
    return value !== "false";
  }

  private async isLedgersEnabled(): Promise<boolean> {
    const value =
      (await this.settingsRepo.get("ledgers.enabled")) ??
      (await this.settingsRepo.get("modules.ledgers.enabled"));
    return value !== "false";
  }

  async executeSideEffectsPhase(
    commitResult: CreateSaleCommitResult,
  ): Promise<void> {
    const { createdSale, userId, currency } = commitResult;

    try {
      await this.auditService.logCreate(
        userId,
        "Sale",
        createdSale.id!,
        {
          invoiceNumber: createdSale.invoiceNumber,
          customerId: createdSale.customerId,
          total: createdSale.total,
          items: createdSale.items?.length,
        },
        `Sale created: Invoice #${createdSale.invoiceNumber}, Total: ${createdSale.total} ${currency}`,
      );
    } catch (auditErr) {
      // Audit logging should not fail the main operation.
      console.warn("Audit logging failed for sale creation:", auditErr);
    }
  }

  async execute(input: CreateSaleInput, userId: number): Promise<Sale> {
    const commitResult = await this.executeCommitPhase(input, userId);
    await this.executeSideEffectsPhase(commitResult);
    return commitResult.createdSale;
  }
}
