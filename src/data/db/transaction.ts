/**
 * Transaction wrapper for multi-table operations.
 * Uses Drizzle ORM's transaction API for atomicity.
 */
import type { DbConnection } from "./db.js";

type TransactionClient = Parameters<Parameters<DbConnection["transaction"]>[0]>[0];

/**
 * Union type that allows any repository method to work both inside and outside
 * a database transaction.  Use `tx ?? this.db` as the Drizzle client.
 */
export type TxOrDb = DbConnection | TransactionClient;

/**
 * Execute a function within a database transaction.
 * If the function throws, the transaction is automatically rolled back.
 *
 * @example
 * ```ts
 * const result = await withTransaction(db, async (tx) => {
 *   const sale = await saleRepo.create(tx, data);
 *   await inventoryRepo.deductStock(tx, items);
 *   await accountingRepo.createEntry(tx, entry);
 *   return sale;
 * });
 * ```
 */
export async function withTransaction<T>(
  db: DbConnection,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}

export type { TransactionClient };
