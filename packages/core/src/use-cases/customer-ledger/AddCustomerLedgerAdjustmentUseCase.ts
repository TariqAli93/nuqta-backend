import { ICustomerLedgerRepository } from "../../interfaces/ICustomerLedgerRepository.js";
import { ICustomerRepository } from "../../interfaces/ICustomerRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError, ValidationError } from "../../errors/DomainErrors.js";
import { CustomerLedgerEntry } from "../../entities/Ledger.js";
import { AuditService } from "../../services/AuditService.js";

export interface LedgerAdjustmentInput {
  customerId: number;
  amount: number; // Positive = Increase Debt, Negative = Decrease Debt
  notes?: string;
}

export class AddCustomerLedgerAdjustmentUseCase {
  private auditService?: AuditService;

  constructor(
    private ledgerRepo: ICustomerLedgerRepository,
    private customerRepo: ICustomerRepository,
    auditRepo?: IAuditRepository,
  ) {
    if (auditRepo) {
      this.auditService = new AuditService(auditRepo);
    }
  }

  async executeCommitPhase(
    data: LedgerAdjustmentInput,
    userId = 1,
  ): Promise<CustomerLedgerEntry> {
    if (!Number.isInteger(data.amount)) {
      throw new ValidationError(
        "Adjustment amount must be an integer IQD amount",
      );
    }

    const customer = await this.customerRepo.findById(data.customerId);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const currentDebt = await this.ledgerRepo.getLastBalanceSync(
      data.customerId,
    );
    const balanceAfter = currentDebt + data.amount;

    const entry = await this.ledgerRepo.createSync({
      customerId: data.customerId,
      transactionType: "adjustment",
      amount: data.amount,
      balanceAfter: balanceAfter,
      notes: data.notes,
      createdBy: userId,
    });

    return entry;
  }

  async execute(
    data: LedgerAdjustmentInput,
    userId = 1,
  ): Promise<CustomerLedgerEntry> {
    const result = await this.executeCommitPhase(data, userId);
    await this.executeSideEffectsPhase(result, data, userId);
    return result;
  }

  async executeSideEffectsPhase(
    entry: CustomerLedgerEntry,
    data: LedgerAdjustmentInput,
    userId: number,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logAction(
        userId,
        "customerLedger:adjustment",
        "Customer",
        data.customerId,
        `Customer ledger adjusted for customer #${data.customerId}`,
        {
          amount: data.amount,
          ledgerEntryId: entry.id,
          notes: data.notes,
        },
      );
    } catch (error) {
      console.warn(
        "Audit logging failed for customer ledger adjustment:",
        error,
      );
    }
  }
}
