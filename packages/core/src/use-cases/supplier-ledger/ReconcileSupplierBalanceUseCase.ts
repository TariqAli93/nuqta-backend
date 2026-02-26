import { ISupplierRepository } from "../../interfaces/ISupplierRepository.js";
import { ISupplierLedgerRepository } from "../../interfaces/ISupplierLedgerRepository.js";

export interface SupplierBalanceDriftItem {
  supplierId: number;
  supplierName: string;
  cachedBalance: number;
  ledgerBalance: number;
  drift: number;
}

export interface ReconcileSupplierBalanceResult {
  driftItems: SupplierBalanceDriftItem[];
  totalSuppliers: number;
  totalDrift: number;
}

export class ReconcileSupplierBalanceUseCase {
  constructor(
    private supplierRepo: ISupplierRepository,
    private supplierLedgerRepo: ISupplierLedgerRepository,
  ) {}

  async execute(): Promise<ReconcileSupplierBalanceResult> {
    const { items: suppliers } = await this.supplierRepo.findAll({
      limit: 100000,
      offset: 0,
    });
    const driftItems: SupplierBalanceDriftItem[] = [];
    let totalDrift = 0;

    for (const supplier of suppliers) {
      if (!supplier.id) continue;
      const cachedBalance = supplier.currentBalance || 0;
      const ledgerBalance = await this.supplierLedgerRepo.getLastBalanceSync(
        supplier.id,
      );
      const drift = cachedBalance - ledgerBalance;
      if (drift !== 0) {
        driftItems.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          cachedBalance,
          ledgerBalance,
          drift,
        });
        totalDrift += Math.abs(drift);
      }
    }

    return {
      driftItems,
      totalSuppliers: suppliers.length,
      totalDrift,
    };
  }

  async repair(): Promise<number> {
    const { driftItems } = await this.execute();
    for (const item of driftItems) {
      await this.supplierRepo.update(item.supplierId, {
        currentBalance: item.ledgerBalance,
      });
    }
    return driftItems.length;
  }
}
