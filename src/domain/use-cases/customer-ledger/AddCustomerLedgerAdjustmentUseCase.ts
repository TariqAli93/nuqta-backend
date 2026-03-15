import { ICustomerLedgerRepository } from "../../interfaces/ICustomerLedgerRepository.js";
import { ICustomerRepository } from "../../interfaces/ICustomerRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError, ValidationError } from "../../shared/errors/DomainErrors.js";
import { CustomerLedgerEntry } from "../../entities/Ledger.js";
import { AuditService } from "../../shared/services/AuditService.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export interface LedgerAdjustmentInput {
  customerId: number;
  amount: number; // Positive = Increase Debt, Negative = Decrease Debt
  notes?: string;
}

export class AddCustomerLedgerAdjustmentUseCase extends WriteUseCase<LedgerAdjustmentInput, CustomerLedgerEntry, CustomerLedgerEntry> {
  private auditService?: AuditService;

  constructor(
    private ledgerRepo: ICustomerLedgerRepository,
    private customerRepo: ICustomerRepository,
    auditRepo?: IAuditRepository,
  ) {
    super();
    if (auditRepo) {
      this.auditService = new AuditService(auditRepo);
    }
  }

  async executeCommitPhase(
    data: LedgerAdjustmentInput,
    userId: string,
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
      createdBy: Number(userId) || 1,
    });

    return entry;
  }

  async executeSideEffectsPhase(
    entry: CustomerLedgerEntry,
    userId: string,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logAction(
        Number(userId) || 1,
        "customerLedger:adjustment",
        "Customer",
        entry.customerId,
        `Customer ledger adjusted for customer #${entry.customerId}`,
        {
          amount: entry.amount,
          ledgerEntryId: entry.id,
          notes: entry.notes,
        },
      );
    } catch (error) {
      console.warn(
        "Audit logging failed for customer ledger adjustment:",
        error,
      );
    }
  }

  toEntity(result: CustomerLedgerEntry): CustomerLedgerEntry {
    return result;
  }
}
