/**
 * Schema barrel – re-exports all domain schemas for convenient importing.
 *
 * Architecture:
 *   /schemas
 *     common.ts          – shared envelopes, error shapes, pagination, $ref schemas
 *     auth.ts            – login, register, setup-status
 *     categories.ts      – CRUD
 *     customers.ts       – CRUD
 *     suppliers.ts       – CRUD + getById
 *     products.ts        – CRUD + adjust-stock, reconcile
 *     sales.ts           – list, getById, create, addPayment
 *     purchases.ts       – list, getById, create, addPayment
 *     inventory.ts       – movements, dashboard, expiry-alerts
 *     accounting.ts      – accounts, journal entries, trial balance, P&L, balance sheet
 *     posting.ts         – period posting, entry post/unpost/reverse
 *     customer-ledger.ts – ledger, payments, adjustments, reconcile
 *     supplier-ledger.ts – ledger, payments, reconcile
 *     settings.ts        – company, currency, modules, wizard, key/value
 *     users.ts           – CRUD
 *     dashboard.ts       – stats
 *     index.ts           – this file
 */

export * from "./common.js";
export * from "./auth.js";
export * from "./categories.js";
export * from "./customers.js";
export * from "./suppliers.js";
export * from "./products.js";
export * from "./sales.js";
export * from "./purchases.js";
export * from "./inventory.js";
export * from "./accounting.js";
export * from "./posting.js";
export * from "./customer-ledger.js";
export * from "./supplier-ledger.js";
export * from "./settings.js";
export * from "./users.js";
export * from "./dashboard.js";
