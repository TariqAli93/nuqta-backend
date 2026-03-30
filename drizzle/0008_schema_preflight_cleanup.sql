CREATE TABLE IF NOT EXISTS "migration_integrity_issues" (
  "id" bigserial PRIMARY KEY,
  "issue_scope" text NOT NULL,
  "table_name" text NOT NULL,
  "row_pk" text NOT NULL,
  "issue_reason" text NOT NULL,
  "detected_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_sale_items" (LIKE "sale_items" INCLUDING ALL);
ALTER TABLE "fk_quarantine_sale_items" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_sale_items" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_purchase_items" (LIKE "purchase_items" INCLUDING ALL);
ALTER TABLE "fk_quarantine_purchase_items" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_purchase_items" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_sale_item_depletions" (LIKE "sale_item_depletions" INCLUDING ALL);
ALTER TABLE "fk_quarantine_sale_item_depletions" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_sale_item_depletions" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_barcode_print_jobs" (LIKE "barcode_print_jobs" INCLUDING ALL);
ALTER TABLE "fk_quarantine_barcode_print_jobs" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_barcode_print_jobs" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_payroll_run_items" (LIKE "payroll_run_items" INCLUDING ALL);
ALTER TABLE "fk_quarantine_payroll_run_items" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_payroll_run_items" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_payment_allocations" (LIKE "payment_allocations" INCLUDING ALL);
ALTER TABLE "fk_quarantine_payment_allocations" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_payment_allocations" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_reconciliation_lines" (LIKE "reconciliation_lines" INCLUDING ALL);
ALTER TABLE "fk_quarantine_reconciliation_lines" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_reconciliation_lines" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_customer_ledger" (LIKE "customer_ledger" INCLUDING ALL);
ALTER TABLE "fk_quarantine_customer_ledger" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_customer_ledger" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_supplier_ledger" (LIKE "supplier_ledger" INCLUDING ALL);
ALTER TABLE "fk_quarantine_supplier_ledger" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_supplier_ledger" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_product_batches" (LIKE "product_batches" INCLUDING ALL);
ALTER TABLE "fk_quarantine_product_batches" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_product_batches" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_inventory_movements" (LIKE "inventory_movements" INCLUDING ALL);
ALTER TABLE "fk_quarantine_inventory_movements" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_inventory_movements" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'supplier'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'legacy_supplier_name'
  ) THEN
    EXECUTE 'ALTER TABLE "products" RENAME COLUMN "supplier" TO "legacy_supplier_name"';
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'expire_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'legacy_expire_date'
  ) THEN
    EXECUTE 'ALTER TABLE "products" RENAME COLUMN "expire_date" TO "legacy_expire_date"';
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_expire'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'legacy_is_expire'
  ) THEN
    EXECUTE 'ALTER TABLE "products" RENAME COLUMN "is_expire" TO "legacy_is_expire"';
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'department'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'legacy_department_name'
  ) THEN
    EXECUTE 'ALTER TABLE "employees" RENAME COLUMN "department" TO "legacy_department_name"';
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payroll_run_items' AND column_name = 'department'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payroll_run_items' AND column_name = 'department_name'
  ) THEN
    EXECUTE 'ALTER TABLE "payroll_run_items" RENAME COLUMN "department" TO "department_name"';
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'balance'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'legacy_balance_cache'
  ) THEN
    EXECUTE 'ALTER TABLE "accounts" RENAME COLUMN "balance" TO "legacy_balance_cache"';
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journal_lines' AND column_name = 'balance'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journal_lines' AND column_name = 'legacy_balance_cache'
  ) THEN
    EXECUTE 'ALTER TABLE "journal_lines" RENAME COLUMN "balance" TO "legacy_balance_cache"';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "track_expiry" boolean NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "department_id" integer;
ALTER TABLE "payroll_run_items" ADD COLUMN IF NOT EXISTS "department_name" text;
--> statement-breakpoint

INSERT INTO "departments" ("name", "is_active", "created_at", "updated_at")
SELECT DISTINCT trim(e."legacy_department_name"), true, now(), now()
FROM "employees" e
WHERE e."legacy_department_name" IS NOT NULL
  AND trim(e."legacy_department_name") <> ''
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint

INSERT INTO "departments" ("name", "description", "is_active", "created_at", "updated_at")
VALUES ('Unassigned', 'Created by schema hardening migration', true, now(), now())
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint

UPDATE "employees" e
SET "department_id" = d."id"
FROM "departments" d
WHERE e."department_id" IS NULL
  AND e."legacy_department_name" IS NOT NULL
  AND trim(e."legacy_department_name") <> ''
  AND d."name" = trim(e."legacy_department_name");
--> statement-breakpoint

UPDATE "employees"
SET "department_id" = (SELECT d."id" FROM "departments" d WHERE d."name" = 'Unassigned' LIMIT 1)
WHERE "department_id" IS NULL;
--> statement-breakpoint

UPDATE "payroll_run_items"
SET "department_name" = COALESCE("department_name", '')
WHERE "department_name" IS NULL;
--> statement-breakpoint

INSERT INTO "suppliers" ("name", "is_active", "created_at", "updated_at")
SELECT supplier_name, true, now(), now()
FROM (
  SELECT DISTINCT trim(p."legacy_supplier_name") AS supplier_name
  FROM "products" p
  WHERE p."supplier_id" IS NULL
    AND p."legacy_supplier_name" IS NOT NULL
    AND trim(p."legacy_supplier_name") <> ''
) AS src
WHERE NOT EXISTS (
  SELECT 1
  FROM "suppliers" s
  WHERE lower(s."name") = lower(src.supplier_name)
);
--> statement-breakpoint

UPDATE "products" p
SET "supplier_id" = s."id"
FROM "suppliers" s
WHERE p."supplier_id" IS NULL
  AND p."legacy_supplier_name" IS NOT NULL
  AND trim(p."legacy_supplier_name") <> ''
  AND lower(s."name") = lower(trim(p."legacy_supplier_name"));
--> statement-breakpoint

UPDATE "products" p
SET "track_expiry" = true
WHERE p."track_expiry" = false
  AND (
    COALESCE(p."legacy_is_expire", false) = true
    OR p."legacy_expire_date" IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM "product_batches" pb
      WHERE pb."product_id" = p."id"
        AND pb."expiry_date" IS NOT NULL
    )
  );
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'sales', s."id"::text, 'customer_id references a missing customer'
FROM "sales" s
LEFT JOIN "customers" c ON c."id" = s."customer_id"
WHERE s."customer_id" IS NOT NULL
  AND c."id" IS NULL;
--> statement-breakpoint

UPDATE "sales" s
SET "customer_id" = NULL
WHERE s."customer_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "customers" c WHERE c."id" = s."customer_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'products', p."id"::text, 'supplier_id references a missing supplier'
FROM "products" p
LEFT JOIN "suppliers" s ON s."id" = p."supplier_id"
WHERE p."supplier_id" IS NOT NULL
  AND s."id" IS NULL;
--> statement-breakpoint

UPDATE "products" p
SET "supplier_id" = NULL
WHERE p."supplier_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "suppliers" s WHERE s."id" = p."supplier_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'payments', p."id"::text, 'sale_id references a missing sale'
FROM "payments" p
LEFT JOIN "sales" s ON s."id" = p."sale_id"
WHERE p."sale_id" IS NOT NULL
  AND s."id" IS NULL;
--> statement-breakpoint

UPDATE "payments" p
SET "sale_id" = NULL
WHERE p."sale_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "sales" s WHERE s."id" = p."sale_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'payments', p."id"::text, 'purchase_id references a missing purchase'
FROM "payments" p
LEFT JOIN "purchases" pu ON pu."id" = p."purchase_id"
WHERE p."purchase_id" IS NOT NULL
  AND pu."id" IS NULL;
--> statement-breakpoint

UPDATE "payments" p
SET "purchase_id" = NULL
WHERE p."purchase_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "purchases" pu WHERE pu."id" = p."purchase_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'payments', p."id"::text, 'customer_id references a missing customer'
FROM "payments" p
LEFT JOIN "customers" c ON c."id" = p."customer_id"
WHERE p."customer_id" IS NOT NULL
  AND c."id" IS NULL;
--> statement-breakpoint

UPDATE "payments" p
SET "customer_id" = NULL
WHERE p."customer_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "customers" c WHERE c."id" = p."customer_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'payments', p."id"::text, 'supplier_id references a missing supplier'
FROM "payments" p
LEFT JOIN "suppliers" s ON s."id" = p."supplier_id"
WHERE p."supplier_id" IS NOT NULL
  AND s."id" IS NULL;
--> statement-breakpoint

UPDATE "payments" p
SET "supplier_id" = NULL
WHERE p."supplier_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "suppliers" s WHERE s."id" = p."supplier_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'product_batches', pb."id"::text, 'purchase_id references a missing purchase'
FROM "product_batches" pb
LEFT JOIN "purchases" pu ON pu."id" = pb."purchase_id"
WHERE pb."purchase_id" IS NOT NULL
  AND pu."id" IS NULL;
--> statement-breakpoint

UPDATE "product_batches" pb
SET "purchase_id" = NULL
WHERE pb."purchase_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "purchases" pu WHERE pu."id" = pb."purchase_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'sale_items', si."id"::text, 'batch_id references a missing batch'
FROM "sale_items" si
LEFT JOIN "product_batches" pb ON pb."id" = si."batch_id"
WHERE si."batch_id" IS NOT NULL
  AND pb."id" IS NULL;
--> statement-breakpoint

UPDATE "sale_items" si
SET "batch_id" = NULL
WHERE si."batch_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "product_batches" pb WHERE pb."id" = si."batch_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'purchase_items', pi."id"::text, 'batch_id references a missing batch'
FROM "purchase_items" pi
LEFT JOIN "product_batches" pb ON pb."id" = pi."batch_id"
WHERE pi."batch_id" IS NOT NULL
  AND pb."id" IS NULL;
--> statement-breakpoint

UPDATE "purchase_items" pi
SET "batch_id" = NULL
WHERE pi."batch_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "product_batches" pb WHERE pb."id" = pi."batch_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'inventory_movements', im."id"::text, 'batch_id references a missing batch'
FROM "inventory_movements" im
LEFT JOIN "product_batches" pb ON pb."id" = im."batch_id"
WHERE im."batch_id" IS NOT NULL
  AND pb."id" IS NULL;
--> statement-breakpoint

UPDATE "inventory_movements" im
SET "batch_id" = NULL
WHERE im."batch_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "product_batches" pb WHERE pb."id" = im."batch_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'journal_entries', je."id"::text, 'posting_batch_id references a missing posting batch'
FROM "journal_entries" je
LEFT JOIN "posting_batches" pb ON pb."id" = je."posting_batch_id"
WHERE je."posting_batch_id" IS NOT NULL
  AND pb."id" IS NULL;
--> statement-breakpoint

UPDATE "journal_entries" je
SET "posting_batch_id" = NULL
WHERE je."posting_batch_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "posting_batches" pb WHERE pb."id" = je."posting_batch_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'journal_entries', je."id"::text, 'reversal_of_id references a missing journal entry'
FROM "journal_entries" je
LEFT JOIN "journal_entries" parent_je ON parent_je."id" = je."reversal_of_id"
WHERE je."reversal_of_id" IS NOT NULL
  AND parent_je."id" IS NULL;
--> statement-breakpoint

UPDATE "journal_entries" je
SET "reversal_of_id" = NULL
WHERE je."reversal_of_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "journal_entries" parent_je WHERE parent_je."id" = je."reversal_of_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'journal_lines', jl."id"::text, 'reconciliation_id references a missing reconciliation'
FROM "journal_lines" jl
LEFT JOIN "reconciliations" r ON r."id" = jl."reconciliation_id"
WHERE jl."reconciliation_id" IS NOT NULL
  AND r."id" IS NULL;
--> statement-breakpoint

UPDATE "journal_lines" jl
SET "reconciliation_id" = NULL
WHERE jl."reconciliation_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "reconciliations" r WHERE r."id" = jl."reconciliation_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'customer_ledger', cl."id"::text, 'sale_id references a missing sale'
FROM "customer_ledger" cl
LEFT JOIN "sales" s ON s."id" = cl."sale_id"
WHERE cl."sale_id" IS NOT NULL
  AND s."id" IS NULL;
--> statement-breakpoint

UPDATE "customer_ledger" cl
SET "sale_id" = NULL
WHERE cl."sale_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "sales" s WHERE s."id" = cl."sale_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'customer_ledger', cl."id"::text, 'payment_id references a missing payment'
FROM "customer_ledger" cl
LEFT JOIN "payments" p ON p."id" = cl."payment_id"
WHERE cl."payment_id" IS NOT NULL
  AND p."id" IS NULL;
--> statement-breakpoint

UPDATE "customer_ledger" cl
SET "payment_id" = NULL
WHERE cl."payment_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."id" = cl."payment_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'customer_ledger', cl."id"::text, 'journal_entry_id references a missing journal entry'
FROM "customer_ledger" cl
LEFT JOIN "journal_entries" je ON je."id" = cl."journal_entry_id"
WHERE cl."journal_entry_id" IS NOT NULL
  AND je."id" IS NULL;
--> statement-breakpoint

UPDATE "customer_ledger" cl
SET "journal_entry_id" = NULL
WHERE cl."journal_entry_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "journal_entries" je WHERE je."id" = cl."journal_entry_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'supplier_ledger', sl."id"::text, 'purchase_id references a missing purchase'
FROM "supplier_ledger" sl
LEFT JOIN "purchases" p ON p."id" = sl."purchase_id"
WHERE sl."purchase_id" IS NOT NULL
  AND p."id" IS NULL;
--> statement-breakpoint

UPDATE "supplier_ledger" sl
SET "purchase_id" = NULL
WHERE sl."purchase_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "purchases" p WHERE p."id" = sl."purchase_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'supplier_ledger', sl."id"::text, 'payment_id references a missing payment'
FROM "supplier_ledger" sl
LEFT JOIN "payments" p ON p."id" = sl."payment_id"
WHERE sl."payment_id" IS NOT NULL
  AND p."id" IS NULL;
--> statement-breakpoint

UPDATE "supplier_ledger" sl
SET "payment_id" = NULL
WHERE sl."payment_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."id" = sl."payment_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'supplier_ledger', sl."id"::text, 'journal_entry_id references a missing journal entry'
FROM "supplier_ledger" sl
LEFT JOIN "journal_entries" je ON je."id" = sl."journal_entry_id"
WHERE sl."journal_entry_id" IS NOT NULL
  AND je."id" IS NULL;
--> statement-breakpoint

UPDATE "supplier_ledger" sl
SET "journal_entry_id" = NULL
WHERE sl."journal_entry_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "journal_entries" je WHERE je."id" = sl."journal_entry_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'accounts', a."id"::text, 'parent_id is missing or self-referential'
FROM "accounts" a
LEFT JOIN "accounts" parent_a ON parent_a."id" = a."parent_id"
WHERE a."parent_id" IS NOT NULL
  AND (parent_a."id" IS NULL OR a."parent_id" = a."id");
--> statement-breakpoint

UPDATE "accounts" a
SET "parent_id" = NULL
WHERE a."parent_id" IS NOT NULL
  AND (
    a."parent_id" = a."id"
    OR NOT EXISTS (SELECT 1 FROM "accounts" parent_a WHERE parent_a."id" = a."parent_id")
  );
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'sale_items', si."id"::text, 'sale_items row is missing required sale or product'
FROM "sale_items" si
LEFT JOIN "sales" s ON s."id" = si."sale_id"
LEFT JOIN "products" p ON p."id" = si."product_id"
WHERE s."id" IS NULL OR si."product_id" IS NULL OR p."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_sale_items"
SELECT si.*, 'sale_items row is missing required sale or product', now()
FROM "sale_items" si
LEFT JOIN "sales" s ON s."id" = si."sale_id"
LEFT JOIN "products" p ON p."id" = si."product_id"
WHERE s."id" IS NULL OR si."product_id" IS NULL OR p."id" IS NULL;
--> statement-breakpoint

DELETE FROM "sale_items" si
WHERE si."id" IN (
  SELECT si2."id"
  FROM "sale_items" si2
  LEFT JOIN "sales" s ON s."id" = si2."sale_id"
  LEFT JOIN "products" p ON p."id" = si2."product_id"
  WHERE s."id" IS NULL OR si2."product_id" IS NULL OR p."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'purchase_items', pi."id"::text, 'purchase_items row is missing required purchase or product'
FROM "purchase_items" pi
LEFT JOIN "purchases" pu ON pu."id" = pi."purchase_id"
LEFT JOIN "products" p ON p."id" = pi."product_id"
WHERE pu."id" IS NULL OR p."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_purchase_items"
SELECT pi.*, 'purchase_items row is missing required purchase or product', now()
FROM "purchase_items" pi
LEFT JOIN "purchases" pu ON pu."id" = pi."purchase_id"
LEFT JOIN "products" p ON p."id" = pi."product_id"
WHERE pu."id" IS NULL OR p."id" IS NULL;
--> statement-breakpoint

DELETE FROM "purchase_items" pi
WHERE pi."id" IN (
  SELECT pi2."id"
  FROM "purchase_items" pi2
  LEFT JOIN "purchases" pu ON pu."id" = pi2."purchase_id"
  LEFT JOIN "products" p ON p."id" = pi2."product_id"
  WHERE pu."id" IS NULL OR p."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'sale_item_depletions', sid."id"::text, 'sale_item_depletions row is missing required parent row'
FROM "sale_item_depletions" sid
LEFT JOIN "sales" s ON s."id" = sid."sale_id"
LEFT JOIN "sale_items" si ON si."id" = sid."sale_item_id"
LEFT JOIN "products" p ON p."id" = sid."product_id"
LEFT JOIN "product_batches" pb ON pb."id" = sid."batch_id"
WHERE s."id" IS NULL OR si."id" IS NULL OR p."id" IS NULL OR pb."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_sale_item_depletions"
SELECT sid.*, 'sale_item_depletions row is missing required parent row', now()
FROM "sale_item_depletions" sid
LEFT JOIN "sales" s ON s."id" = sid."sale_id"
LEFT JOIN "sale_items" si ON si."id" = sid."sale_item_id"
LEFT JOIN "products" p ON p."id" = sid."product_id"
LEFT JOIN "product_batches" pb ON pb."id" = sid."batch_id"
WHERE s."id" IS NULL OR si."id" IS NULL OR p."id" IS NULL OR pb."id" IS NULL;
--> statement-breakpoint

DELETE FROM "sale_item_depletions" sid
WHERE sid."id" IN (
  SELECT sid2."id"
  FROM "sale_item_depletions" sid2
  LEFT JOIN "sales" s ON s."id" = sid2."sale_id"
  LEFT JOIN "sale_items" si ON si."id" = sid2."sale_item_id"
  LEFT JOIN "products" p ON p."id" = sid2."product_id"
  LEFT JOIN "product_batches" pb ON pb."id" = sid2."batch_id"
  WHERE s."id" IS NULL OR si."id" IS NULL OR p."id" IS NULL OR pb."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'payment_allocations', pa."id"::text, 'payment_allocations row is missing required payment or sale'
FROM "payment_allocations" pa
LEFT JOIN "payments" p ON p."id" = pa."payment_id"
LEFT JOIN "sales" s ON s."id" = pa."sale_id"
WHERE p."id" IS NULL OR s."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_payment_allocations"
SELECT pa.*, 'payment_allocations row is missing required payment or sale', now()
FROM "payment_allocations" pa
LEFT JOIN "payments" p ON p."id" = pa."payment_id"
LEFT JOIN "sales" s ON s."id" = pa."sale_id"
WHERE p."id" IS NULL OR s."id" IS NULL;
--> statement-breakpoint

DELETE FROM "payment_allocations" pa
WHERE pa."id" IN (
  SELECT pa2."id"
  FROM "payment_allocations" pa2
  LEFT JOIN "payments" p ON p."id" = pa2."payment_id"
  LEFT JOIN "sales" s ON s."id" = pa2."sale_id"
  WHERE p."id" IS NULL OR s."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'barcode_print_jobs', bpj."id"::text, 'barcode_print_jobs row is missing required template or product'
FROM "barcode_print_jobs" bpj
LEFT JOIN "barcode_templates" bt ON bt."id" = bpj."template_id"
LEFT JOIN "products" p ON p."id" = bpj."product_id"
WHERE bt."id" IS NULL OR p."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_barcode_print_jobs"
SELECT bpj.*, 'barcode_print_jobs row is missing required template or product', now()
FROM "barcode_print_jobs" bpj
LEFT JOIN "barcode_templates" bt ON bt."id" = bpj."template_id"
LEFT JOIN "products" p ON p."id" = bpj."product_id"
WHERE bt."id" IS NULL OR p."id" IS NULL;
--> statement-breakpoint

DELETE FROM "barcode_print_jobs" bpj
WHERE bpj."id" IN (
  SELECT bpj2."id"
  FROM "barcode_print_jobs" bpj2
  LEFT JOIN "barcode_templates" bt ON bt."id" = bpj2."template_id"
  LEFT JOIN "products" p ON p."id" = bpj2."product_id"
  WHERE bt."id" IS NULL OR p."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'payroll_run_items', pri."id"::text, 'payroll_run_items row is missing required payroll run or employee'
FROM "payroll_run_items" pri
LEFT JOIN "payroll_runs" pr ON pr."id" = pri."payroll_run_id"
LEFT JOIN "employees" e ON e."id" = pri."employee_id"
WHERE pr."id" IS NULL OR e."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_payroll_run_items"
SELECT pri.*, 'payroll_run_items row is missing required payroll run or employee', now()
FROM "payroll_run_items" pri
LEFT JOIN "payroll_runs" pr ON pr."id" = pri."payroll_run_id"
LEFT JOIN "employees" e ON e."id" = pri."employee_id"
WHERE pr."id" IS NULL OR e."id" IS NULL;
--> statement-breakpoint

DELETE FROM "payroll_run_items" pri
WHERE pri."id" IN (
  SELECT pri2."id"
  FROM "payroll_run_items" pri2
  LEFT JOIN "payroll_runs" pr ON pr."id" = pri2."payroll_run_id"
  LEFT JOIN "employees" e ON e."id" = pri2."employee_id"
  WHERE pr."id" IS NULL OR e."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'reconciliation_lines', rl."id"::text, 'reconciliation_lines row is missing required reconciliation or journal line'
FROM "reconciliation_lines" rl
LEFT JOIN "reconciliations" r ON r."id" = rl."reconciliation_id"
LEFT JOIN "journal_lines" jl ON jl."id" = rl."journal_entry_line_id"
WHERE r."id" IS NULL OR jl."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_reconciliation_lines"
SELECT rl.*, 'reconciliation_lines row is missing required reconciliation or journal line', now()
FROM "reconciliation_lines" rl
LEFT JOIN "reconciliations" r ON r."id" = rl."reconciliation_id"
LEFT JOIN "journal_lines" jl ON jl."id" = rl."journal_entry_line_id"
WHERE r."id" IS NULL OR jl."id" IS NULL;
--> statement-breakpoint

DELETE FROM "reconciliation_lines" rl
WHERE rl."id" IN (
  SELECT rl2."id"
  FROM "reconciliation_lines" rl2
  LEFT JOIN "reconciliations" r ON r."id" = rl2."reconciliation_id"
  LEFT JOIN "journal_lines" jl ON jl."id" = rl2."journal_entry_line_id"
  WHERE r."id" IS NULL OR jl."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'customer_ledger', cl."id"::text, 'customer_ledger row is missing required customer'
FROM "customer_ledger" cl
LEFT JOIN "customers" c ON c."id" = cl."customer_id"
WHERE c."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_customer_ledger"
SELECT cl.*, 'customer_ledger row is missing required customer', now()
FROM "customer_ledger" cl
LEFT JOIN "customers" c ON c."id" = cl."customer_id"
WHERE c."id" IS NULL;
--> statement-breakpoint

DELETE FROM "customer_ledger" cl
WHERE cl."id" IN (
  SELECT cl2."id"
  FROM "customer_ledger" cl2
  LEFT JOIN "customers" c ON c."id" = cl2."customer_id"
  WHERE c."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'supplier_ledger', sl."id"::text, 'supplier_ledger row is missing required supplier'
FROM "supplier_ledger" sl
LEFT JOIN "suppliers" s ON s."id" = sl."supplier_id"
WHERE s."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_supplier_ledger"
SELECT sl.*, 'supplier_ledger row is missing required supplier', now()
FROM "supplier_ledger" sl
LEFT JOIN "suppliers" s ON s."id" = sl."supplier_id"
WHERE s."id" IS NULL;
--> statement-breakpoint

DELETE FROM "supplier_ledger" sl
WHERE sl."id" IN (
  SELECT sl2."id"
  FROM "supplier_ledger" sl2
  LEFT JOIN "suppliers" s ON s."id" = sl2."supplier_id"
  WHERE s."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'product_batches', pb."id"::text, 'product_batches row is missing required product'
FROM "product_batches" pb
LEFT JOIN "products" p ON p."id" = pb."product_id"
WHERE p."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_product_batches"
SELECT pb.*, 'product_batches row is missing required product', now()
FROM "product_batches" pb
LEFT JOIN "products" p ON p."id" = pb."product_id"
WHERE p."id" IS NULL;
--> statement-breakpoint

DELETE FROM "product_batches" pb
WHERE pb."id" IN (
  SELECT pb2."id"
  FROM "product_batches" pb2
  LEFT JOIN "products" p ON p."id" = pb2."product_id"
  WHERE p."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'inventory_movements', im."id"::text, 'inventory_movements row is missing required product'
FROM "inventory_movements" im
LEFT JOIN "products" p ON p."id" = im."product_id"
WHERE p."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_inventory_movements"
SELECT im.*, 'inventory_movements row is missing required product', now()
FROM "inventory_movements" im
LEFT JOIN "products" p ON p."id" = im."product_id"
WHERE p."id" IS NULL;
--> statement-breakpoint

DELETE FROM "inventory_movements" im
WHERE im."id" IN (
  SELECT im2."id"
  FROM "inventory_movements" im2
  LEFT JOIN "products" p ON p."id" = im2."product_id"
  WHERE p."id" IS NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_product_units" (LIKE "product_units" INCLUDING ALL);
ALTER TABLE "fk_quarantine_product_units" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_product_units" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fk_quarantine_journal_lines" (LIKE "journal_lines" INCLUDING ALL);
ALTER TABLE "fk_quarantine_journal_lines" ADD COLUMN IF NOT EXISTS "quarantine_reason" text;
ALTER TABLE "fk_quarantine_journal_lines" ADD COLUMN IF NOT EXISTS "quarantined_at" timestamp with time zone NOT NULL DEFAULT now();
--> statement-breakpoint

INSERT INTO "suppliers" ("name", "is_active", "created_at", "updated_at")
SELECT 'Unknown migration supplier', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1
  FROM "suppliers" s
  WHERE lower(s."name") = lower('Unknown migration supplier')
);
--> statement-breakpoint

INSERT INTO "users" ("username", "password", "full_name", "role", "is_active", "created_at", "updated_at")
VALUES ('migration-system', '!migration-placeholder!', 'Migration System User', 'admin', false, now(), now())
ON CONFLICT ("username") DO NOTHING;
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'products', p."id"::text, 'category_id references a missing category'
FROM "products" p
LEFT JOIN "categories" c ON c."id" = p."category_id"
WHERE p."category_id" IS NOT NULL
  AND c."id" IS NULL;
--> statement-breakpoint

UPDATE "products" p
SET "category_id" = NULL
WHERE p."category_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "categories" c WHERE c."id" = p."category_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'purchases', pu."id"::text, 'supplier_id references a missing supplier; remapped to Unknown migration supplier'
FROM "purchases" pu
LEFT JOIN "suppliers" s ON s."id" = pu."supplier_id"
WHERE pu."supplier_id" IS NULL
   OR s."id" IS NULL;
--> statement-breakpoint

UPDATE "purchases" pu
SET "supplier_id" = (
  SELECT s."id"
  FROM "suppliers" s
  WHERE s."name" = 'Unknown migration supplier'
  LIMIT 1
)
WHERE pu."supplier_id" IS NULL
   OR NOT EXISTS (SELECT 1 FROM "suppliers" s WHERE s."id" = pu."supplier_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'payroll_runs', pr."id"::text, 'journal_entry_id references a missing journal entry'
FROM "payroll_runs" pr
LEFT JOIN "journal_entries" je ON je."id" = pr."journal_entry_id"
WHERE pr."journal_entry_id" IS NOT NULL
  AND je."id" IS NULL;
--> statement-breakpoint

UPDATE "payroll_runs" pr
SET "journal_entry_id" = NULL
WHERE pr."journal_entry_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "journal_entries" je WHERE je."id" = pr."journal_entry_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'employees', e."id"::text, 'department_id was NULL or invalid; remapped to Unassigned'
FROM "employees" e
LEFT JOIN "departments" d ON d."id" = e."department_id"
WHERE e."department_id" IS NULL
   OR d."id" IS NULL;
--> statement-breakpoint

UPDATE "employees" e
SET "department_id" = (
  SELECT d."id"
  FROM "departments" d
  WHERE d."name" = 'Unassigned'
  LIMIT 1
)
WHERE e."department_id" IS NULL
   OR NOT EXISTS (SELECT 1 FROM "departments" d WHERE d."id" = e."department_id");
--> statement-breakpoint

DO $$
DECLARE
  ref record;
BEGIN
  FOR ref IN
    SELECT * FROM (VALUES
      ('customers', 'created_by'),
      ('suppliers', 'created_by'),
      ('categories', 'created_by'),
      ('products', 'created_by'),
      ('sales', 'created_by'),
      ('purchases', 'created_by'),
      ('payments', 'created_by'),
      ('inventory_movements', 'created_by'),
      ('departments', 'created_by'),
      ('employees', 'created_by'),
      ('payroll_runs', 'created_by'),
      ('payroll_runs', 'approved_by'),
      ('posting_batches', 'created_by'),
      ('reconciliations', 'created_by'),
      ('customer_ledger', 'created_by'),
      ('supplier_ledger', 'created_by'),
      ('barcode_print_jobs', 'created_by'),
      ('settings', 'updated_by'),
      ('system_settings', 'updated_by'),
      ('accounting_settings', 'updated_by'),
      ('pos_settings', 'updated_by'),
      ('barcode_settings', 'updated_by')
    ) AS refs(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ref.table_name
        AND column_name = ref.column_name
    ) THEN
      EXECUTE format(
        'INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
         SELECT %L, %L, t."id"::text, %L
         FROM %I t
         LEFT JOIN "users" u ON u."id" = t.%I
         WHERE t.%I IS NOT NULL
           AND u."id" IS NULL',
        'fk_cleanup',
        ref.table_name,
        ref.column_name || ' references a missing user',
        ref.table_name,
        ref.column_name,
        ref.column_name
      );

      EXECUTE format(
        'UPDATE %I
         SET %I = NULL
         WHERE %I IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = %I)',
        ref.table_name,
        ref.column_name,
        ref.column_name,
        ref.column_name
      );
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'audit_logs', al."id"::text, 'user_id references a missing user; remapped to migration-system'
FROM "audit_logs" al
LEFT JOIN "users" u ON u."id" = al."user_id"
WHERE u."id" IS NULL;
--> statement-breakpoint

UPDATE "audit_logs" al
SET "user_id" = (
  SELECT u."id"
  FROM "users" u
  WHERE u."username" = 'migration-system'
  LIMIT 1
)
WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = al."user_id");
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'product_units', pu."id"::text, 'product_units row is missing required product'
FROM "product_units" pu
LEFT JOIN "products" p ON p."id" = pu."product_id"
WHERE p."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_product_units"
SELECT pu.*, 'product_units row is missing required product', now()
FROM "product_units" pu
LEFT JOIN "products" p ON p."id" = pu."product_id"
WHERE p."id" IS NULL;
--> statement-breakpoint

DELETE FROM "product_units" pu
WHERE pu."id" IN (
  SELECT pu2."id"
  FROM "product_units" pu2
  LEFT JOIN "products" p ON p."id" = pu2."product_id"
  WHERE p."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'journal_lines', jl."id"::text, 'journal_lines row is missing required journal entry or account'
FROM "journal_lines" jl
LEFT JOIN "journal_entries" je ON je."id" = jl."journal_entry_id"
LEFT JOIN "accounts" a ON a."id" = jl."account_id"
WHERE je."id" IS NULL OR a."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_journal_lines"
SELECT jl.*, 'journal_lines row is missing required journal entry or account', now()
FROM "journal_lines" jl
LEFT JOIN "journal_entries" je ON je."id" = jl."journal_entry_id"
LEFT JOIN "accounts" a ON a."id" = jl."account_id"
WHERE je."id" IS NULL OR a."id" IS NULL;
--> statement-breakpoint

DELETE FROM "journal_lines" jl
WHERE jl."id" IN (
  SELECT jl2."id"
  FROM "journal_lines" jl2
  LEFT JOIN "journal_entries" je ON je."id" = jl2."journal_entry_id"
  LEFT JOIN "accounts" a ON a."id" = jl2."account_id"
  WHERE je."id" IS NULL OR a."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'fk_cleanup', 'reconciliation_lines', rl."id"::text, 'reconciliation_lines row became orphaned after journal_lines cleanup'
FROM "reconciliation_lines" rl
LEFT JOIN "reconciliations" r ON r."id" = rl."reconciliation_id"
LEFT JOIN "journal_lines" jl ON jl."id" = rl."journal_entry_line_id"
WHERE r."id" IS NULL OR jl."id" IS NULL;
--> statement-breakpoint

INSERT INTO "fk_quarantine_reconciliation_lines"
SELECT rl.*, 'reconciliation_lines row became orphaned after journal_lines cleanup', now()
FROM "reconciliation_lines" rl
LEFT JOIN "reconciliations" r ON r."id" = rl."reconciliation_id"
LEFT JOIN "journal_lines" jl ON jl."id" = rl."journal_entry_line_id"
WHERE r."id" IS NULL OR jl."id" IS NULL;
--> statement-breakpoint

DELETE FROM "reconciliation_lines" rl
WHERE rl."id" IN (
  SELECT rl2."id"
  FROM "reconciliation_lines" rl2
  LEFT JOIN "reconciliations" r ON r."id" = rl2."reconciliation_id"
  LEFT JOIN "journal_lines" jl ON jl."id" = rl2."journal_entry_line_id"
  WHERE r."id" IS NULL OR jl."id" IS NULL
);
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'duplicate_check', 'products', MIN(p."id")::text, 'duplicate barcode detected: ' || p."barcode"
FROM "products" p
WHERE p."barcode" IS NOT NULL AND trim(p."barcode") <> ''
GROUP BY p."barcode"
HAVING COUNT(*) > 1;
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'duplicate_check', 'sales', MIN(s."id")::text, 'duplicate idempotency_key detected: ' || s."idempotency_key"
FROM "sales" s
WHERE s."idempotency_key" IS NOT NULL AND trim(s."idempotency_key") <> ''
GROUP BY s."idempotency_key"
HAVING COUNT(*) > 1;
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'duplicate_check', 'purchases', MIN(pu."id")::text, 'duplicate idempotency_key detected: ' || pu."idempotency_key"
FROM "purchases" pu
WHERE pu."idempotency_key" IS NOT NULL AND trim(pu."idempotency_key") <> ''
GROUP BY pu."idempotency_key"
HAVING COUNT(*) > 1;
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'duplicate_check', 'payments', MIN(p."id")::text, 'duplicate idempotency_key detected: ' || p."idempotency_key"
FROM "payments" p
WHERE p."idempotency_key" IS NOT NULL AND trim(p."idempotency_key") <> ''
GROUP BY p."idempotency_key"
HAVING COUNT(*) > 1;
--> statement-breakpoint
