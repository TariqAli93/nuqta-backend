import { ICustomerRepository } from "../../interfaces/ICustomerRepository.js";
import { ICustomerLedgerRepository } from "../../interfaces/ICustomerLedgerRepository.js";

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

export class ReconcileCustomerDebtUseCase {
  constructor(
    private customerRepo: ICustomerRepository,
    private customerLedgerRepo: ICustomerLedgerRepository,
  ) {}

  async execute(): Promise<ReconcileCustomerDebtResult> {
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

  async repair(): Promise<number> {
    const { driftItems } = await this.execute();
    for (const item of driftItems) {
      await this.customerRepo.update(item.customerId, {
        totalDebt: item.ledgerDebt,
      });
    }
    return driftItems.length;
  }
}
