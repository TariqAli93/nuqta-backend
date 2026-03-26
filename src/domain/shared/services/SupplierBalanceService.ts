/**
 * SupplierBalanceService
 *
 * Centralizes supplier.currentBalance synchronization so that no use-case
 * duplicates manual add/subtract math.
 *
 * Core invariant (must hold after every purchase mutation):
 *   supplier.currentBalance += (newRemainingAmount - oldRemainingAmount)
 *
 * This delta-based approach is safe for all mutations:
 *   - create purchase        → delta = +remainingAmount
 *   - register payment       → delta = -paymentAmount  (= newRemaining - oldRemaining)
 *   - cancel/void purchase   → delta = -oldRemainingAmount
 *   - edit purchase totals   → delta = newRemaining - oldRemaining
 */
import type { ISupplierRepository } from "../../interfaces/ISupplierRepository.js";
import type { TxOrDb } from "../../../data/db/transaction.js";

/**
 * Apply a signed delta to supplier.currentBalance inside the given transaction.
 *
 * @param supplierRepo  - repository with transactional updatePayable support
 * @param supplierId    - supplier whose balance must be adjusted
 * @param delta         - amount to add (positive) or subtract (negative)
 * @param tx            - transaction client; pass the enclosing tx for atomicity
 */
export async function syncSupplierBalance(
  supplierRepo: ISupplierRepository,
  supplierId: number,
  delta: number,
  tx?: TxOrDb,
): Promise<void> {
  if (delta === 0) return;
  await supplierRepo.updatePayable(supplierId, delta, tx);
}
