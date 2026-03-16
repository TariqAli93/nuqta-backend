import { ICustomerRepository } from "../../interfaces/ICustomerRepository.js";
import { ICustomerLedgerRepository } from "../../interfaces/ICustomerLedgerRepository.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export interface CustomerDebtDriftItem {
  customerId: number;
  customerName: string;
  cachedDebt: number;
  ledgerDebt: number;
  drift: number;
}

export interface ReconcileCustomerDebtResult {
  driftItems: CustomerDebtDriftItem[];
  totalCustomers: number;
  totalDrift: number;
}

export class ReconcileCustomerDebtUseCase extends WriteUseCase<void, ReconcileCustomerDebtResult, ReconcileCustomerDebtResult> {
  constructor(
    private customerRepo: ICustomerRepository,
    private customerLedgerRepo: ICustomerLedgerRepository,
  ) {
    super();
  }

  async executeCommitPhase(_input: void, _userId: string): Promise<ReconcileCustomerDebtResult> {
    const { items: customers } = await this.customerRepo.findAll({
      limit: 100000,
      offset: 0,
    });
    const driftItems: CustomerDebtDriftItem[] = [];
    let totalDrift = 0;

    for (const customer of customers) {
      if (!customer.id) continue;
      const cachedDebt = customer.totalDebt || 0;
      const ledgerDebt = await this.customerLedgerRepo.getLastBalanceSync(
        customer.id,
      );
      const drift = cachedDebt - ledgerDebt;
      if (drift !== 0) {
        driftItems.push({
          customerId: customer.id,
          customerName: customer.name,
          cachedDebt,
          ledgerDebt,
          drift,
        });
        totalDrift += Math.abs(drift);
      }
    }

    return {
      driftItems,
      totalCustomers: customers.length,
      totalDrift,
    };
  }

  executeSideEffectsPhase(_result: ReconcileCustomerDebtResult, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: ReconcileCustomerDebtResult): ReconcileCustomerDebtResult {
    return result;
  }

  async repair(): Promise<number> {
    const result = await this.executeCommitPhase(undefined as void, "0");
    for (const item of result.driftItems) {
      await this.customerRepo.update(item.customerId, {
        totalDebt: item.ledgerDebt,
      });
    }
    return result.driftItems.length;
  }
}
