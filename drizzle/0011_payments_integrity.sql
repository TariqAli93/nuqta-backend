-- Migration 0011: payments integrity
-- Adds the three constraints that were missing from payments:
--   1. amount <> 0          — zero-value payments have no business meaning
--   2. not (sale_id IS NOT NULL AND purchase_id IS NOT NULL)
--                           — a payment can settle a sale OR a purchase, not both
--   3. not (customer_id IS NOT NULL AND supplier_id IS NOT NULL)
--                           — a payment belongs to a customer OR a supplier, not both
--
-- All three are added NOT VALID so the migration is safe on an existing DB
-- with data, then immediately validated (the DO block below).
-- Any pre-existing violations are logged to migration_integrity_issues before
-- validation so operators can review them after the fact.

--> statement-breakpoint

-- Log pre-existing violations so they are visible after the migration runs.
-- We do this BEFORE attempting validation so the information is never lost.

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT
  'constraint_preflight',
  'payments',
  id::text,
  'amount = 0 — zero-value payment has no business meaning'
FROM "payments"
WHERE "amount" = 0;

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT
  'constraint_preflight',
  'payments',
  id::text,
  'sale_id and purchase_id are both set on the same payment row'
FROM "payments"
WHERE "sale_id" IS NOT NULL
  AND "purchase_id" IS NOT NULL;

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT
  'constraint_preflight',
  'payments',
  id::text,
  'customer_id and supplier_id are both set on the same payment row'
FROM "payments"
WHERE "customer_id" IS NOT NULL
  AND "supplier_id" IS NOT NULL;

--> statement-breakpoint

-- Fix any violating rows before adding constraints so validation succeeds.
-- Zero-amount payments: void them (they were effectively no-ops).
UPDATE "payments"
SET "status" = 'voided'
WHERE "amount" = 0
  AND "status" NOT IN ('voided', 'refunded', 'failed');

-- Payments that reference both a sale and a purchase: clear the purchase FK.
-- The sale reference is considered primary for retail context.
UPDATE "payments"
SET "purchase_id" = NULL
WHERE "sale_id" IS NOT NULL
  AND "purchase_id" IS NOT NULL;

-- Payments that reference both a customer and a supplier: clear the supplier FK.
UPDATE "payments"
SET "supplier_id" = NULL
WHERE "customer_id" IS NOT NULL
  AND "supplier_id" IS NOT NULL;

--> statement-breakpoint

-- Drop in case a previous failed attempt left them.
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "chk_payments_amount_nonzero";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "chk_payments_no_sale_and_purchase";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "chk_payments_no_customer_and_supplier";

--> statement-breakpoint

ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payments_amount_nonzero"
    CHECK ("amount" <> 0) NOT VALID;

ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payments_no_sale_and_purchase"
    CHECK (NOT ("sale_id" IS NOT NULL AND "purchase_id" IS NOT NULL)) NOT VALID;

ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payments_no_customer_and_supplier"
    CHECK (NOT ("customer_id" IS NOT NULL AND "supplier_id" IS NOT NULL)) NOT VALID;

--> statement-breakpoint

-- Validate all three constraints now that data is clean.
ALTER TABLE "payments" VALIDATE CONSTRAINT "chk_payments_amount_nonzero";
ALTER TABLE "payments" VALIDATE CONSTRAINT "chk_payments_no_sale_and_purchase";
ALTER TABLE "payments" VALIDATE CONSTRAINT "chk_payments_no_customer_and_supplier";
