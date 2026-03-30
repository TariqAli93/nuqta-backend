CREATE OR REPLACE FUNCTION "__ensure_enum"(enum_name text, enum_values text[])
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  ddl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = enum_name) THEN
    SELECT format(
      'CREATE TYPE %I AS ENUM (%s)',
      enum_name,
      string_agg(quote_literal(v), ', ' ORDER BY ord)
    )
    INTO ddl
    FROM unnest(enum_values) WITH ORDINALITY AS t(v, ord);

    EXECUTE ddl;
  END IF;
END $$;
--> statement-breakpoint

SELECT "__ensure_enum"('user_role', ARRAY['admin', 'manager', 'cashier']);
SELECT "__ensure_enum"('product_status', ARRAY['available', 'out_of_stock', 'discontinued']);
SELECT "__ensure_enum"('product_batch_status', ARRAY['active', 'expired', 'depleted', 'recalled']);
SELECT "__ensure_enum"('sale_status', ARRAY['pending', 'completed', 'cancelled', 'refunded', 'partial_refund']);
SELECT "__ensure_enum"('sale_payment_type', ARRAY['cash', 'credit', 'mixed']);
SELECT "__ensure_enum"('sale_payment_method', ARRAY['cash', 'card', 'bank_transfer', 'credit']);
SELECT "__ensure_enum"('print_status', ARRAY['pending', 'printed', 'failed']);
SELECT "__ensure_enum"('purchase_status', ARRAY['pending', 'completed', 'cancelled', 'received', 'partial']);
SELECT "__ensure_enum"('payment_status', ARRAY['pending', 'completed', 'voided', 'refunded', 'failed']);
SELECT "__ensure_enum"('payment_method', ARRAY['cash', 'card', 'bank_transfer', 'credit', 'refund']);
SELECT "__ensure_enum"('inventory_movement_type', ARRAY['in', 'out', 'adjust']);
SELECT "__ensure_enum"('inventory_movement_reason', ARRAY['sale', 'purchase', 'return', 'cancellation', 'refund', 'damage', 'manual', 'opening']);
SELECT "__ensure_enum"('payroll_run_status', ARRAY['draft', 'submitted', 'approved', 'disbursed', 'cancelled']);
SELECT "__ensure_enum"('account_type', ARRAY['asset', 'liability', 'equity', 'revenue', 'expense']);
SELECT "__ensure_enum"('posting_batch_period_type', ARRAY['day', 'month', 'year']);
SELECT "__ensure_enum"('posting_batch_status', ARRAY['draft', 'posted', 'locked']);
SELECT "__ensure_enum"('reconciliation_type', ARRAY['customer', 'supplier', 'account']);
SELECT "__ensure_enum"('reconciliation_status', ARRAY['open', 'partially_paid', 'paid']);
SELECT "__ensure_enum"('journal_source_type', ARRAY['sale', 'purchase', 'payment', 'adjustment', 'manual', 'sale_cancellation', 'sale_refund', 'payment_reversal', 'credit_note', 'payroll']);
SELECT "__ensure_enum"('barcode_type', ARRAY['CODE128', 'EAN13', 'EAN8', 'UPC', 'QR']);
SELECT "__ensure_enum"('barcode_print_job_status', ARRAY['pending', 'printed', 'failed']);
SELECT "__ensure_enum"('pos_paper_size', ARRAY['thermal', 'a4', 'letter']);
SELECT "__ensure_enum"('pos_layout_direction', ARRAY['rtl', 'ltr']);
SELECT "__ensure_enum"('accounting_cost_method', ARRAY['fifo', 'weighted_average']);
SELECT "__ensure_enum"('accounting_rounding_method', ARRAY['round', 'floor', 'ceil']);
--> statement-breakpoint

DROP FUNCTION "__ensure_enum"(text, text[]);
--> statement-breakpoint

UPDATE "users"
SET "role" = 'cashier'
WHERE "role" IS NULL OR "role" NOT IN ('admin', 'manager', 'cashier');
--> statement-breakpoint

UPDATE "products"
SET "status" = CASE
  WHEN COALESCE("is_active", true) = false THEN 'discontinued'
  WHEN COALESCE("stock", 0) <= 0 THEN 'out_of_stock'
  ELSE 'available'
END
WHERE "status" IS NULL OR "status" NOT IN ('available', 'out_of_stock', 'discontinued');
--> statement-breakpoint

UPDATE "product_batches"
SET "status" = CASE
  WHEN COALESCE("quantity_on_hand", 0) <= 0 THEN 'depleted'
  WHEN "expiry_date" IS NOT NULL AND "expiry_date"::date < CURRENT_DATE THEN 'expired'
  ELSE 'active'
END
WHERE "status" IS NULL OR "status" NOT IN ('active', 'expired', 'depleted', 'recalled');
--> statement-breakpoint

UPDATE "sales"
SET
  "payment_type" = CASE
    WHEN COALESCE("remaining_amount", 0) > 0 AND COALESCE("paid_amount", 0) > 0 THEN 'mixed'
    WHEN COALESCE("remaining_amount", 0) > 0 THEN 'credit'
    ELSE 'cash'
  END,
  "payment_method" = COALESCE(NULLIF("payment_method", ''), 'cash'),
  "status" = CASE
    WHEN COALESCE("refunded_amount", 0) >= COALESCE("paid_amount", 0) AND COALESCE("refunded_amount", 0) > 0 THEN 'refunded'
    WHEN COALESCE("refunded_amount", 0) > 0 THEN 'partial_refund'
    WHEN COALESCE("remaining_amount", 0) > 0 THEN 'pending'
    ELSE 'completed'
  END,
  "print_status" = COALESCE(NULLIF("print_status", ''), 'pending')
WHERE
  "payment_type" IS NULL OR "payment_type" NOT IN ('cash', 'credit', 'mixed')
  OR "payment_method" IS NULL OR "payment_method" NOT IN ('cash', 'card', 'bank_transfer', 'credit')
  OR "status" IS NULL OR "status" NOT IN ('pending', 'completed', 'cancelled', 'refunded', 'partial_refund')
  OR "print_status" IS NULL OR "print_status" NOT IN ('pending', 'printed', 'failed');
--> statement-breakpoint

UPDATE "purchases"
SET "status" = CASE
  WHEN COALESCE("received_at", NULL) IS NOT NULL AND COALESCE("remaining_amount", 0) > 0 THEN 'partial'
  WHEN COALESCE("received_at", NULL) IS NOT NULL THEN 'received'
  WHEN COALESCE("remaining_amount", 0) <= 0 THEN 'completed'
  ELSE 'pending'
END
WHERE "status" IS NULL OR "status" NOT IN ('pending', 'completed', 'cancelled', 'received', 'partial');
--> statement-breakpoint

UPDATE "payments"
SET
  "payment_method" = CASE
    WHEN COALESCE("amount", 0) < 0 THEN 'refund'
    ELSE COALESCE(NULLIF("payment_method", ''), 'cash')
  END,
  "status" = CASE
    WHEN COALESCE("amount", 0) < 0 THEN 'refunded'
    ELSE COALESCE(NULLIF("status", ''), 'completed')
  END
WHERE
  "payment_method" IS NULL OR "payment_method" NOT IN ('cash', 'card', 'bank_transfer', 'credit', 'refund')
  OR "status" IS NULL OR "status" NOT IN ('pending', 'completed', 'voided', 'refunded', 'failed');
--> statement-breakpoint

UPDATE "payroll_runs"
SET "status" = COALESCE(NULLIF("status", ''), 'draft')
WHERE "status" IS NULL OR "status" NOT IN ('draft', 'submitted', 'approved', 'disbursed', 'cancelled');
--> statement-breakpoint

UPDATE "reconciliations"
SET
  "type" = COALESCE(NULLIF("type", ''), 'account'),
  "status" = COALESCE(NULLIF("status", ''), 'open')
WHERE
  "type" IS NULL OR "type" NOT IN ('customer', 'supplier', 'account')
  OR "status" IS NULL OR "status" NOT IN ('open', 'partially_paid', 'paid');
--> statement-breakpoint

UPDATE "inventory_movements"
SET
  "movement_type" = COALESCE(NULLIF("movement_type", ''), 'adjust'),
  "reason" = COALESCE(NULLIF("reason", ''), 'manual')
WHERE
  "movement_type" IS NULL OR "movement_type" NOT IN ('in', 'out', 'adjust')
  OR "reason" IS NULL OR "reason" NOT IN ('sale', 'purchase', 'return', 'cancellation', 'refund', 'damage', 'manual', 'opening');
--> statement-breakpoint

UPDATE "journal_entries"
SET "source_type" = 'manual'
WHERE "source_type" IS NOT NULL
  AND "source_type" NOT IN ('sale', 'purchase', 'payment', 'adjustment', 'manual', 'sale_cancellation', 'sale_refund', 'payment_reversal', 'credit_note', 'payroll');
--> statement-breakpoint

UPDATE "barcode_templates"
SET "barcode_type" = COALESCE(NULLIF("barcode_type", ''), 'CODE128')
WHERE "barcode_type" IS NULL OR "barcode_type" NOT IN ('CODE128', 'EAN13', 'EAN8', 'UPC', 'QR');
--> statement-breakpoint

UPDATE "barcode_print_jobs"
SET "status" = COALESCE(NULLIF("status", ''), 'pending')
WHERE "status" IS NULL OR "status" NOT IN ('pending', 'printed', 'failed');
--> statement-breakpoint

UPDATE "pos_settings"
SET
  "paper_size" = COALESCE(NULLIF("paper_size", ''), 'thermal'),
  "layout_direction" = COALESCE(NULLIF("layout_direction", ''), 'rtl')
WHERE
  "paper_size" IS NULL OR "paper_size" NOT IN ('thermal', 'a4', 'letter')
  OR "layout_direction" IS NULL OR "layout_direction" NOT IN ('rtl', 'ltr');
--> statement-breakpoint

UPDATE "accounting_settings"
SET
  "cost_method" = COALESCE(NULLIF("cost_method", ''), 'fifo'),
  "rounding_method" = COALESCE(NULLIF("rounding_method", ''), 'round')
WHERE
  "cost_method" IS NULL OR "cost_method" NOT IN ('fifo', 'weighted_average')
  OR "rounding_method" IS NULL OR "rounding_method" NOT IN ('round', 'floor', 'ceil');
--> statement-breakpoint

INSERT INTO "migration_integrity_issues" ("issue_scope", "table_name", "row_pk", "issue_reason")
SELECT 'type_conversion', 'posting_batches', pb."id"::text, 'period_start or period_end was not ISO date text; fallback date will be used'
FROM "posting_batches" pb
WHERE NOT (left(trim(pb."period_start"), 10) ~ '^\d{4}-\d{2}-\d{2}$')
   OR NOT (left(trim(pb."period_end"), 10) ~ '^\d{4}-\d{2}-\d{2}$');
--> statement-breakpoint

ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role",
  ALTER COLUMN "role" SET DEFAULT 'cashier';
ALTER TABLE "products"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "product_status" USING "status"::"product_status",
  ALTER COLUMN "status" SET DEFAULT 'available';
ALTER TABLE "product_batches"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "product_batch_status" USING "status"::"product_batch_status",
  ALTER COLUMN "status" SET DEFAULT 'active',
  ALTER COLUMN "expiry_date" TYPE date USING CASE WHEN "expiry_date" IS NULL THEN NULL ELSE "expiry_date"::date END,
  ALTER COLUMN "manufacturing_date" TYPE date USING CASE WHEN "manufacturing_date" IS NULL THEN NULL ELSE "manufacturing_date"::date END;
ALTER TABLE "sales"
  ALTER COLUMN "exchange_rate" TYPE numeric(18,6) USING COALESCE("exchange_rate", 1)::numeric(18,6),
  ALTER COLUMN "interest_rate" TYPE numeric(18,6) USING (COALESCE("interest_rate", 0)::numeric(18,6) / 100.0),
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "sale_status" USING "status"::"sale_status",
  ALTER COLUMN "status" SET DEFAULT 'pending',
  ALTER COLUMN "payment_type" DROP DEFAULT,
  ALTER COLUMN "payment_type" TYPE "sale_payment_type" USING "payment_type"::"sale_payment_type",
  ALTER COLUMN "payment_method" DROP DEFAULT,
  ALTER COLUMN "payment_method" TYPE "sale_payment_method" USING "payment_method"::"sale_payment_method",
  ALTER COLUMN "payment_method" SET DEFAULT 'cash',
  ALTER COLUMN "print_status" DROP DEFAULT,
  ALTER COLUMN "print_status" TYPE "print_status" USING "print_status"::"print_status",
  ALTER COLUMN "print_status" SET DEFAULT 'pending';
ALTER TABLE "purchases"
  ALTER COLUMN "exchange_rate" TYPE numeric(18,6) USING COALESCE("exchange_rate", 1)::numeric(18,6),
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "purchase_status" USING "status"::"purchase_status",
  ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "purchase_items"
  ALTER COLUMN "expiry_date" TYPE date USING CASE WHEN "expiry_date" IS NULL THEN NULL ELSE "expiry_date"::date END;
ALTER TABLE "payments"
  ALTER COLUMN "exchange_rate" TYPE numeric(18,6) USING COALESCE("exchange_rate", 1)::numeric(18,6),
  ALTER COLUMN "payment_method" DROP DEFAULT,
  ALTER COLUMN "payment_method" TYPE "payment_method" USING "payment_method"::"payment_method",
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "payment_status" USING "status"::"payment_status",
  ALTER COLUMN "status" SET DEFAULT 'completed';
ALTER TABLE "inventory_movements"
  ALTER COLUMN "movement_type" DROP DEFAULT,
  ALTER COLUMN "movement_type" TYPE "inventory_movement_type" USING "movement_type"::"inventory_movement_type",
  ALTER COLUMN "reason" DROP DEFAULT,
  ALTER COLUMN "reason" TYPE "inventory_movement_reason" USING "reason"::"inventory_movement_reason";
ALTER TABLE "payroll_runs"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "payroll_run_status" USING "status"::"payroll_run_status",
  ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "accounts"
  ALTER COLUMN "account_type" DROP DEFAULT,
  ALTER COLUMN "account_type" TYPE "account_type" USING "account_type"::"account_type";
ALTER TABLE "posting_batches"
  ALTER COLUMN "period_type" DROP DEFAULT,
  ALTER COLUMN "period_type" TYPE "posting_batch_period_type" USING "period_type"::"posting_batch_period_type",
  ALTER COLUMN "period_type" SET DEFAULT 'day',
  ALTER COLUMN "period_start" TYPE date USING CASE
    WHEN left(trim("period_start"), 10) ~ '^\d{4}-\d{2}-\d{2}$' THEN left(trim("period_start"), 10)::date
    ELSE COALESCE("posted_at"::date, CURRENT_DATE)
  END,
  ALTER COLUMN "period_end" TYPE date USING CASE
    WHEN left(trim("period_end"), 10) ~ '^\d{4}-\d{2}-\d{2}$' THEN left(trim("period_end"), 10)::date
    ELSE COALESCE("posted_at"::date, CURRENT_DATE)
  END,
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "posting_batch_status" USING "status"::"posting_batch_status",
  ALTER COLUMN "status" SET DEFAULT 'posted';
ALTER TABLE "journal_entries"
  ALTER COLUMN "source_type" DROP DEFAULT,
  ALTER COLUMN "source_type" TYPE "journal_source_type" USING CASE
    WHEN "source_type" IS NULL THEN NULL
    ELSE "source_type"::"journal_source_type"
  END;
ALTER TABLE "reconciliations"
  ALTER COLUMN "type" DROP DEFAULT,
  ALTER COLUMN "type" TYPE "reconciliation_type" USING "type"::"reconciliation_type",
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "reconciliation_status" USING "status"::"reconciliation_status",
  ALTER COLUMN "status" SET DEFAULT 'open';
ALTER TABLE "barcode_templates"
  ALTER COLUMN "barcode_type" DROP DEFAULT,
  ALTER COLUMN "barcode_type" TYPE "barcode_type" USING "barcode_type"::"barcode_type",
  ALTER COLUMN "barcode_type" SET DEFAULT 'CODE128';
ALTER TABLE "barcode_print_jobs"
  ALTER COLUMN "expiry_date" TYPE date USING CASE WHEN "expiry_date" IS NULL THEN NULL ELSE "expiry_date"::date END,
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "barcode_print_job_status" USING "status"::"barcode_print_job_status",
  ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "currency_settings"
  ALTER COLUMN "exchange_rate" TYPE numeric(18,6) USING COALESCE("exchange_rate", 1)::numeric(18,6);
ALTER TABLE "accounting_settings"
  ALTER COLUMN "default_tax_rate" TYPE numeric(18,6) USING COALESCE("default_tax_rate", 0)::numeric(18,6),
  ALTER COLUMN "usd_exchange_rate" TYPE numeric(18,6) USING COALESCE("usd_exchange_rate", 1480)::numeric(18,6),
  ALTER COLUMN "cost_method" DROP DEFAULT,
  ALTER COLUMN "cost_method" TYPE "accounting_cost_method" USING "cost_method"::"accounting_cost_method",
  ALTER COLUMN "cost_method" SET DEFAULT 'fifo',
  ALTER COLUMN "rounding_method" DROP DEFAULT,
  ALTER COLUMN "rounding_method" TYPE "accounting_rounding_method" USING "rounding_method"::"accounting_rounding_method",
  ALTER COLUMN "rounding_method" SET DEFAULT 'round';
ALTER TABLE "pos_settings"
  ALTER COLUMN "paper_size" DROP DEFAULT,
  ALTER COLUMN "paper_size" TYPE "pos_paper_size" USING "paper_size"::"pos_paper_size",
  ALTER COLUMN "paper_size" SET DEFAULT 'thermal',
  ALTER COLUMN "layout_direction" DROP DEFAULT,
  ALTER COLUMN "layout_direction" TYPE "pos_layout_direction" USING "layout_direction"::"pos_layout_direction",
  ALTER COLUMN "layout_direction" SET DEFAULT 'rtl';
--> statement-breakpoint

ALTER TABLE "products"
  ALTER COLUMN "track_expiry" SET DEFAULT false,
  ALTER COLUMN "track_expiry" SET NOT NULL;
ALTER TABLE "employees"
  ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "sale_items"
  ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "payroll_run_items"
  ALTER COLUMN "department_name" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "journal_lines"
  ADD COLUMN IF NOT EXISTS "balance" integer GENERATED ALWAYS AS (COALESCE("debit", 0) - COALESCE("credit", 0)) STORED;
--> statement-breakpoint

ALTER TABLE "product_units" DROP CONSTRAINT IF EXISTS "chk_product_units_factor_positive";
ALTER TABLE "product_units" DROP CONSTRAINT IF EXISTS "chk_product_units_selling_price_nonnegative";
ALTER TABLE "product_batches" DROP CONSTRAINT IF EXISTS "chk_batches_qty_received_positive";
ALTER TABLE "product_batches" DROP CONSTRAINT IF EXISTS "chk_batches_qty_on_hand_nonnegative";
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "chk_sales_discount_nonneg";
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "chk_sales_tax_nonneg";
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "chk_sales_total_nonneg";
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "chk_sales_paid_nonneg";
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "chk_sales_remaining_nonneg";
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "chk_purchases_discount_nonneg";
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "chk_purchases_tax_nonneg";
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "chk_purchases_total_nonneg";
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "chk_purchases_paid_nonneg";
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "chk_purchases_remaining_nonneg";
ALTER TABLE "journal_lines" DROP CONSTRAINT IF EXISTS "chk_jl_debit_nonneg";
ALTER TABLE "journal_lines" DROP CONSTRAINT IF EXISTS "chk_jl_credit_nonneg";
ALTER TABLE "journal_lines" DROP CONSTRAINT IF EXISTS "chk_jl_nonzero";
ALTER TABLE "customer_ledger" DROP CONSTRAINT IF EXISTS "chk_cust_ledger_txtype";
ALTER TABLE "supplier_ledger" DROP CONSTRAINT IF EXISTS "chk_supp_ledger_txtype";
ALTER TABLE "sale_items" DROP CONSTRAINT IF EXISTS "fk_sale_items_sale";
ALTER TABLE "sale_item_depletions" DROP CONSTRAINT IF EXISTS "fk_sid_sale";
ALTER TABLE "sale_item_depletions" DROP CONSTRAINT IF EXISTS "fk_sid_batch";
ALTER TABLE "purchase_items" DROP CONSTRAINT IF EXISTS "fk_purchase_items_purchase";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "fk_payments_sale";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "fk_payments_purchase";
ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "fk_inv_mov_batch";
ALTER TABLE "journal_lines" DROP CONSTRAINT IF EXISTS "fk_jl_entry";
ALTER TABLE "journal_entries" DROP CONSTRAINT IF EXISTS "fk_je_reversal_of";
ALTER TABLE "customer_ledger" DROP CONSTRAINT IF EXISTS "fk_cl_customer";
ALTER TABLE "customer_ledger" DROP CONSTRAINT IF EXISTS "fk_cl_sale";
ALTER TABLE "customer_ledger" DROP CONSTRAINT IF EXISTS "fk_cl_payment";
ALTER TABLE "supplier_ledger" DROP CONSTRAINT IF EXISTS "fk_sl_supplier";
ALTER TABLE "supplier_ledger" DROP CONSTRAINT IF EXISTS "fk_sl_purchase";
ALTER TABLE "supplier_ledger" DROP CONSTRAINT IF EXISTS "fk_sl_payment";
ALTER TABLE "product_batches" DROP CONSTRAINT IF EXISTS "fk_batches_product";
ALTER TABLE "product_batches" DROP CONSTRAINT IF EXISTS "fk_batches_purchase";
--> statement-breakpoint

ALTER TABLE "products"
  ADD CONSTRAINT "chk_products_cost_price_nonnegative" CHECK ("cost_price" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_products_selling_price_nonnegative" CHECK ("selling_price" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_products_stock_nonnegative" CHECK ("stock" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_products_min_stock_nonnegative" CHECK ("min_stock" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_products_version_positive" CHECK ("version" >= 1) NOT VALID;
ALTER TABLE "product_units"
  ADD CONSTRAINT "chk_product_units_factor_positive" CHECK ("factor_to_base" >= 1) NOT VALID,
  ADD CONSTRAINT "chk_product_units_selling_price_nonnegative" CHECK ("selling_price" IS NULL OR "selling_price" >= 0) NOT VALID;
ALTER TABLE "product_batches"
  ADD CONSTRAINT "chk_batches_qty_received_nonnegative" CHECK ("quantity_received" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_batches_qty_on_hand_nonnegative" CHECK ("quantity_on_hand" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_batches_cost_per_unit_nonnegative" CHECK ("cost_per_unit" IS NULL OR "cost_per_unit" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_batches_version_positive" CHECK ("version" >= 1) NOT VALID,
  ADD CONSTRAINT "chk_batches_expiry_after_manufacture" CHECK ("expiry_date" IS NULL OR "manufacturing_date" IS NULL OR "expiry_date" >= "manufacturing_date") NOT VALID;
ALTER TABLE "sales"
  ADD CONSTRAINT "chk_sales_subtotal_nonnegative" CHECK ("subtotal" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_discount_nonnegative" CHECK ("discount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_tax_nonnegative" CHECK ("tax" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_total_nonnegative" CHECK ("total" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_paid_nonnegative" CHECK ("paid_amount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_refunded_nonnegative" CHECK ("refunded_amount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_remaining_nonnegative" CHECK ("remaining_amount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_exchange_rate_positive" CHECK ("exchange_rate" > 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_interest_rate_nonnegative" CHECK ("interest_rate" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_interest_amount_nonnegative" CHECK ("interest_amount" >= 0) NOT VALID;
ALTER TABLE "sale_items"
  ADD CONSTRAINT "chk_sale_items_quantity_positive" CHECK ("quantity" > 0) NOT VALID,
  ADD CONSTRAINT "chk_sale_items_unit_factor_positive" CHECK ("unit_factor" >= 1) NOT VALID,
  ADD CONSTRAINT "chk_sale_items_quantity_base_positive" CHECK ("quantity_base" IS NULL OR "quantity_base" > 0) NOT VALID,
  ADD CONSTRAINT "chk_sale_items_unit_price_nonnegative" CHECK ("unit_price" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sale_items_discount_nonnegative" CHECK ("discount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sale_items_subtotal_nonnegative" CHECK ("subtotal" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sale_items_returned_quantity_nonnegative" CHECK ("returned_quantity_base" >= 0) NOT VALID;
ALTER TABLE "sale_item_depletions"
  ADD CONSTRAINT "chk_sale_item_depletions_quantity_positive" CHECK ("quantity_base" > 0) NOT VALID,
  ADD CONSTRAINT "chk_sale_item_depletions_cost_nonnegative" CHECK ("cost_per_unit" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sale_item_depletions_total_nonnegative" CHECK ("total_cost" >= 0) NOT VALID;
ALTER TABLE "purchases"
  ADD CONSTRAINT "chk_purchases_subtotal_nonnegative" CHECK ("subtotal" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_discount_nonnegative" CHECK ("discount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_tax_nonnegative" CHECK ("tax" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_total_nonnegative" CHECK ("total" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_paid_nonnegative" CHECK ("paid_amount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_remaining_nonnegative" CHECK ("remaining_amount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_exchange_rate_positive" CHECK ("exchange_rate" > 0) NOT VALID;
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "chk_purchase_items_quantity_positive" CHECK ("quantity" > 0) NOT VALID,
  ADD CONSTRAINT "chk_purchase_items_unit_factor_positive" CHECK ("unit_factor" >= 1) NOT VALID,
  ADD CONSTRAINT "chk_purchase_items_quantity_base_positive" CHECK ("quantity_base" > 0) NOT VALID,
  ADD CONSTRAINT "chk_purchase_items_unit_cost_nonnegative" CHECK ("unit_cost" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchase_items_discount_nonnegative" CHECK ("discount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchase_items_line_subtotal_nonnegative" CHECK ("line_subtotal" >= 0) NOT VALID;
ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payments_exchange_rate_positive" CHECK ("exchange_rate" > 0) NOT VALID;
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "chk_payment_allocations_amount_positive" CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "chk_inventory_movements_quantity_nonzero" CHECK ("quantity_base" <> 0) NOT VALID,
  ADD CONSTRAINT "chk_inventory_movements_unit_factor_positive" CHECK ("unit_factor" >= 1) NOT VALID,
  ADD CONSTRAINT "chk_inventory_movements_cost_per_unit_nonnegative" CHECK ("cost_per_unit" IS NULL OR "cost_per_unit" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_inventory_movements_total_cost_nonnegative" CHECK ("total_cost" IS NULL OR "total_cost" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_inventory_movements_stock_before_nonnegative" CHECK ("stock_before" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_inventory_movements_stock_after_nonnegative" CHECK ("stock_after" >= 0) NOT VALID;
ALTER TABLE "employees"
  ADD CONSTRAINT "chk_employees_salary_nonnegative" CHECK ("salary" >= 0) NOT VALID;
ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "chk_payroll_runs_period_year" CHECK ("period_year" BETWEEN 2000 AND 9999) NOT VALID,
  ADD CONSTRAINT "chk_payroll_runs_period_month" CHECK ("period_month" BETWEEN 1 AND 12) NOT VALID,
  ADD CONSTRAINT "chk_payroll_runs_gross_nonnegative" CHECK ("total_gross_pay" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_payroll_runs_deductions_nonnegative" CHECK ("total_deductions" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_payroll_runs_bonuses_nonnegative" CHECK ("total_bonuses" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_payroll_runs_net_nonnegative" CHECK ("total_net_pay" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_payroll_runs_totals_consistent" CHECK ("total_net_pay" = "total_gross_pay" - "total_deductions" + "total_bonuses") NOT VALID;
ALTER TABLE "posting_batches"
  ADD CONSTRAINT "chk_posting_batches_entries_nonnegative" CHECK ("entries_count" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_posting_batches_total_nonnegative" CHECK ("total_amount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_posting_batches_period_order" CHECK ("period_end" >= "period_start") NOT VALID;
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "chk_journal_entries_total_nonnegative" CHECK ("total_amount" >= 0) NOT VALID;
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "chk_journal_lines_debit_nonnegative" CHECK ("debit" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_journal_lines_credit_nonnegative" CHECK ("credit" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_journal_lines_exactly_one_side" CHECK ((("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0))) NOT VALID;
ALTER TABLE "payroll_run_items"
  ADD CONSTRAINT "chk_payroll_run_items_gross_nonnegative" CHECK ("gross_pay" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_payroll_run_items_deductions_nonnegative" CHECK ("deductions" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_payroll_run_items_bonuses_nonnegative" CHECK ("bonuses" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_payroll_run_items_net_nonnegative" CHECK ("net_pay" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_payroll_run_items_totals_consistent" CHECK ("net_pay" = "gross_pay" - "deductions" + "bonuses") NOT VALID;
ALTER TABLE "reconciliation_lines"
  ADD CONSTRAINT "chk_reconciliation_lines_amount_positive" CHECK ("amount" > 0) NOT VALID;
ALTER TABLE "customer_ledger"
  ADD CONSTRAINT "chk_customer_ledger_amount_nonnegative" CHECK ("amount" >= 0) NOT VALID;
ALTER TABLE "supplier_ledger"
  ADD CONSTRAINT "chk_supplier_ledger_amount_nonnegative" CHECK ("amount" >= 0) NOT VALID;
--> statement-breakpoint

ALTER TABLE "products"
  ADD CONSTRAINT "fk_products_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_products_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "product_units"
  ADD CONSTRAINT "fk_product_units_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "product_batches"
  ADD CONSTRAINT "fk_product_batches_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_product_batches_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "sales"
  ADD CONSTRAINT "fk_sales_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "sale_items"
  ADD CONSTRAINT "fk_sale_items_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_sale_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_sale_items_batch" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "sale_item_depletions"
  ADD CONSTRAINT "fk_sale_item_depletions_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_sale_item_depletions_item" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_sale_item_depletions_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_sale_item_depletions_batch" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "purchases"
  ADD CONSTRAINT "fk_purchases_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "fk_purchase_items_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_purchase_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_purchase_items_batch" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "payments"
  ADD CONSTRAINT "fk_payments_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_payments_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_payments_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_payments_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "fk_payment_allocations_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_payment_allocations_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "fk_inventory_movements_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_inventory_movements_batch" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "employees"
  ADD CONSTRAINT "fk_employees_department" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "fk_payroll_runs_journal_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "accounts"
  ADD CONSTRAINT "fk_accounts_parent" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "fk_journal_entries_reversal_of" FOREIGN KEY ("reversal_of_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_journal_entries_posting_batch" FOREIGN KEY ("posting_batch_id") REFERENCES "posting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "fk_journal_lines_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_journal_lines_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_journal_lines_reconciliation" FOREIGN KEY ("reconciliation_id") REFERENCES "reconciliations"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "payroll_run_items"
  ADD CONSTRAINT "fk_payroll_run_items_run" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_payroll_run_items_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "reconciliation_lines"
  ADD CONSTRAINT "fk_reconciliation_lines_reconciliation" FOREIGN KEY ("reconciliation_id") REFERENCES "reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_reconciliation_lines_journal_line" FOREIGN KEY ("journal_entry_line_id") REFERENCES "journal_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "customer_ledger"
  ADD CONSTRAINT "fk_customer_ledger_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_customer_ledger_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_customer_ledger_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_customer_ledger_journal_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "supplier_ledger"
  ADD CONSTRAINT "fk_supplier_ledger_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_supplier_ledger_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_supplier_ledger_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_supplier_ledger_journal_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "barcode_print_jobs"
  ADD CONSTRAINT "fk_barcode_print_jobs_template" FOREIGN KEY ("template_id") REFERENCES "barcode_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_barcode_print_jobs_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
