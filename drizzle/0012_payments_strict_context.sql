-- Migration 0012: stricter payments context constraints
--
-- Migration 0011 added three constraints:
--   • amount <> 0
--   • NOT (sale_id IS NOT NULL AND purchase_id IS NOT NULL)
--   • NOT (customer_id IS NOT NULL AND supplier_id IS NOT NULL)
--
-- This migration adds the remaining three constraints needed to close every
-- polymorphic loophole and require a minimum business context:
--
--   4. chk_payments_no_sale_and_supplier
--      A sale-context payment must not reference a supplier.
--      Observed pattern: sale payments set saleId + optional customerId.
--      A supplier FK on a sale payment would be semantically incoherent.
--
--   5. chk_payments_no_purchase_and_customer
--      A purchase-context payment must not reference a customer.
--      Observed pattern: purchase payments set purchaseId + supplierId.
--      A customer FK on a purchase payment would be semantically incoherent.
--
--   6. chk_payments_has_context
--      Every payment must reference at least one business entity
--      (sale, purchase, customer, or supplier).
--      An all-null payment row is an orphan and provides no traceability.
--
-- All constraints are added NOT VALID, pre-existing violations are logged
-- and repaired, then each constraint is validated explicitly.
-- ---------------------------------------------------------------------------

--> statement-breakpoint

-- ── 1. Log pre-existing violations ──────────────────────────────────────────

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT
  'constraint_preflight',
  'payments',
  id::text,
  'sale_id and supplier_id are both set — sale payment must not reference a supplier'
FROM "payments"
WHERE "sale_id" IS NOT NULL
  AND "supplier_id" IS NOT NULL;

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT
  'constraint_preflight',
  'payments',
  id::text,
  'purchase_id and customer_id are both set — purchase payment must not reference a customer'
FROM "payments"
WHERE "purchase_id" IS NOT NULL
  AND "customer_id" IS NOT NULL;

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT
  'constraint_preflight',
  'payments',
  id::text,
  'all FK columns are NULL — payment has no business context'
FROM "payments"
WHERE "sale_id"     IS NULL
  AND "purchase_id" IS NULL
  AND "customer_id" IS NULL
  AND "supplier_id" IS NULL;

--> statement-breakpoint

-- ── 2. Repair violations ─────────────────────────────────────────────────────
--
-- Rule 4 violation (sale_id + supplier_id both set): sale is the primary
-- context for sale-side payments; clear the incoherent supplier FK.
UPDATE "payments"
SET "supplier_id" = NULL
WHERE "sale_id" IS NOT NULL
  AND "supplier_id" IS NOT NULL;

-- Rule 5 violation (purchase_id + customer_id both set): purchase is the
-- primary context for purchase-side payments; clear the incoherent customer FK.
UPDATE "payments"
SET "customer_id" = NULL
WHERE "purchase_id" IS NOT NULL
  AND "customer_id" IS NOT NULL;

-- Rule 6 violation (all FKs null): void the orphan row — it carries no
-- traceable context and cannot be attributed to any business transaction.
UPDATE "payments"
SET "status" = 'voided'
WHERE "sale_id"     IS NULL
  AND "purchase_id" IS NULL
  AND "customer_id" IS NULL
  AND "supplier_id" IS NULL
  AND "status" NOT IN ('voided', 'failed');

-- Rule 6 cannot be enforced as NOT NULL directly because every FK column is
-- nullable by design. We therefore need the CHECK form, which operates on the
-- row as a whole. The UPDATE above voids stray rows but does NOT satisfy the
-- constraint because voided rows still have all-null FKs.  We need to give
-- them a sentinel context to pass validation.  The cleanest option is to keep
-- the voided status and rely on the application never creating context-less
-- rows going forward; alternatively set a placeholder.  Here we leave them
-- voided; if the DB still has all-null rows after the UPDATE, the VALIDATE
-- step below will fail loudly — which is the correct behaviour (operator must
-- investigate and assign context or delete those rows).

--> statement-breakpoint

-- ── 3. Drop any stale attempt ────────────────────────────────────────────────
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "chk_payments_no_sale_and_supplier";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "chk_payments_no_purchase_and_customer";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "chk_payments_has_context";

--> statement-breakpoint

-- ── 4. Add constraints NOT VALID ─────────────────────────────────────────────
ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payments_no_sale_and_supplier"
    CHECK (NOT ("sale_id" IS NOT NULL AND "supplier_id" IS NOT NULL)) NOT VALID;

ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payments_no_purchase_and_customer"
    CHECK (NOT ("purchase_id" IS NOT NULL AND "customer_id" IS NOT NULL)) NOT VALID;

ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payments_has_context"
    CHECK (
      "sale_id"     IS NOT NULL OR
      "purchase_id" IS NOT NULL OR
      "customer_id" IS NOT NULL OR
      "supplier_id" IS NOT NULL
    ) NOT VALID;

--> statement-breakpoint

-- ── 5. Validate ───────────────────────────────────────────────────────────────
ALTER TABLE "payments" VALIDATE CONSTRAINT "chk_payments_no_sale_and_supplier";
ALTER TABLE "payments" VALIDATE CONSTRAINT "chk_payments_no_purchase_and_customer";
ALTER TABLE "payments" VALIDATE CONSTRAINT "chk_payments_has_context";
