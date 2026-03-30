ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "fk_customers_created_by";
ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "fk_suppliers_created_by";
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "fk_categories_created_by";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "fk_products_created_by";
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "fk_sales_created_by";
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "fk_purchases_created_by";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "fk_payments_created_by";
ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "fk_inventory_movements_created_by";
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "fk_departments_created_by";
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "fk_employees_created_by";
ALTER TABLE "payroll_runs" DROP CONSTRAINT IF EXISTS "fk_payroll_runs_created_by";
ALTER TABLE "payroll_runs" DROP CONSTRAINT IF EXISTS "fk_payroll_runs_approved_by";
ALTER TABLE "posting_batches" DROP CONSTRAINT IF EXISTS "fk_posting_batches_created_by";
ALTER TABLE "reconciliations" DROP CONSTRAINT IF EXISTS "fk_reconciliations_created_by";
ALTER TABLE "customer_ledger" DROP CONSTRAINT IF EXISTS "fk_customer_ledger_created_by";
ALTER TABLE "supplier_ledger" DROP CONSTRAINT IF EXISTS "fk_supplier_ledger_created_by";
ALTER TABLE "barcode_print_jobs" DROP CONSTRAINT IF EXISTS "fk_barcode_print_jobs_created_by";
ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "fk_settings_updated_by";
ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "fk_system_settings_updated_by";
ALTER TABLE "accounting_settings" DROP CONSTRAINT IF EXISTS "fk_accounting_settings_updated_by";
ALTER TABLE "pos_settings" DROP CONSTRAINT IF EXISTS "fk_pos_settings_updated_by";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "fk_barcode_settings_updated_by";
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "fk_audit_logs_user";
ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "chk_suppliers_opening_balance_nonnegative";
ALTER TABLE "currency_settings" DROP CONSTRAINT IF EXISTS "chk_currency_settings_exchange_rate_positive";
ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "chk_system_settings_low_stock_threshold_nonnegative";
ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "chk_system_settings_expiry_alert_days_nonnegative";
ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "chk_system_settings_debt_reminder_count_nonnegative";
ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "chk_system_settings_debt_interval_nonnegative";
ALTER TABLE "accounting_settings" DROP CONSTRAINT IF EXISTS "chk_accounting_settings_default_tax_rate_nonnegative";
ALTER TABLE "accounting_settings" DROP CONSTRAINT IF EXISTS "chk_accounting_settings_usd_rate_positive";
ALTER TABLE "accounting_settings" DROP CONSTRAINT IF EXISTS "chk_accounting_settings_fiscal_month";
ALTER TABLE "accounting_settings" DROP CONSTRAINT IF EXISTS "chk_accounting_settings_fiscal_day";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "chk_barcode_settings_default_width_positive";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "chk_barcode_settings_default_height_positive";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "chk_barcode_settings_print_dpi_positive";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "chk_barcode_settings_label_width_positive";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "chk_barcode_settings_label_height_positive";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "chk_barcode_settings_margin_top_nonnegative";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "chk_barcode_settings_margin_bottom_nonnegative";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "chk_barcode_settings_margin_left_nonnegative";
ALTER TABLE "barcode_settings" DROP CONSTRAINT IF EXISTS "chk_barcode_settings_margin_right_nonnegative";
ALTER TABLE "barcode_print_jobs" DROP CONSTRAINT IF EXISTS "chk_barcode_print_jobs_quantity_positive";
ALTER TABLE "barcode_print_jobs" DROP CONSTRAINT IF EXISTS "chk_barcode_print_jobs_price_nonnegative";
--> statement-breakpoint

ALTER TABLE "customers"
  ADD CONSTRAINT "fk_customers_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "suppliers"
  ADD CONSTRAINT "fk_suppliers_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "categories"
  ADD CONSTRAINT "fk_categories_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "products"
  ADD CONSTRAINT "fk_products_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "sales"
  ADD CONSTRAINT "fk_sales_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "purchases"
  ADD CONSTRAINT "fk_purchases_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "payments"
  ADD CONSTRAINT "fk_payments_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "fk_inventory_movements_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "departments"
  ADD CONSTRAINT "fk_departments_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "employees"
  ADD CONSTRAINT "fk_employees_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "fk_payroll_runs_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_payroll_runs_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "posting_batches"
  ADD CONSTRAINT "fk_posting_batches_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "reconciliations"
  ADD CONSTRAINT "fk_reconciliations_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "customer_ledger"
  ADD CONSTRAINT "fk_customer_ledger_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "supplier_ledger"
  ADD CONSTRAINT "fk_supplier_ledger_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "barcode_print_jobs"
  ADD CONSTRAINT "fk_barcode_print_jobs_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "settings"
  ADD CONSTRAINT "fk_settings_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "system_settings"
  ADD CONSTRAINT "fk_system_settings_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "accounting_settings"
  ADD CONSTRAINT "fk_accounting_settings_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "pos_settings"
  ADD CONSTRAINT "fk_pos_settings_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "barcode_settings"
  ADD CONSTRAINT "fk_barcode_settings_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "fk_audit_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
--> statement-breakpoint

ALTER TABLE "suppliers"
  ADD CONSTRAINT "chk_suppliers_opening_balance_nonnegative" CHECK ("opening_balance" >= 0) NOT VALID;
ALTER TABLE "currency_settings"
  ADD CONSTRAINT "chk_currency_settings_exchange_rate_positive" CHECK ("exchange_rate" > 0) NOT VALID;
ALTER TABLE "system_settings"
  ADD CONSTRAINT "chk_system_settings_low_stock_threshold_nonnegative" CHECK ("low_stock_threshold" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_system_settings_expiry_alert_days_nonnegative" CHECK ("expiry_alert_days" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_system_settings_debt_reminder_count_nonnegative" CHECK ("debt_reminder_count" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_system_settings_debt_interval_nonnegative" CHECK ("debt_reminder_interval_days" >= 0) NOT VALID;
ALTER TABLE "accounting_settings"
  ADD CONSTRAINT "chk_accounting_settings_default_tax_rate_nonnegative" CHECK ("default_tax_rate" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_accounting_settings_usd_rate_positive" CHECK ("usd_exchange_rate" > 0) NOT VALID,
  ADD CONSTRAINT "chk_accounting_settings_fiscal_month" CHECK ("fiscal_year_start_month" BETWEEN 1 AND 12) NOT VALID,
  ADD CONSTRAINT "chk_accounting_settings_fiscal_day" CHECK ("fiscal_year_start_day" BETWEEN 1 AND 31) NOT VALID;
ALTER TABLE "barcode_settings"
  ADD CONSTRAINT "chk_barcode_settings_default_width_positive" CHECK ("default_width" > 0) NOT VALID,
  ADD CONSTRAINT "chk_barcode_settings_default_height_positive" CHECK ("default_height" > 0) NOT VALID,
  ADD CONSTRAINT "chk_barcode_settings_print_dpi_positive" CHECK ("print_dpi" > 0) NOT VALID,
  ADD CONSTRAINT "chk_barcode_settings_label_width_positive" CHECK ("label_width_mm" > 0) NOT VALID,
  ADD CONSTRAINT "chk_barcode_settings_label_height_positive" CHECK ("label_height_mm" > 0) NOT VALID,
  ADD CONSTRAINT "chk_barcode_settings_margin_top_nonnegative" CHECK ("margin_top" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_barcode_settings_margin_bottom_nonnegative" CHECK ("margin_bottom" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_barcode_settings_margin_left_nonnegative" CHECK ("margin_left" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_barcode_settings_margin_right_nonnegative" CHECK ("margin_right" >= 0) NOT VALID;
ALTER TABLE "barcode_print_jobs"
  ADD CONSTRAINT "chk_barcode_print_jobs_quantity_positive" CHECK ("quantity" > 0) NOT VALID,
  ADD CONSTRAINT "chk_barcode_print_jobs_price_nonnegative" CHECK ("price" IS NULL OR "price" >= 0) NOT VALID;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_products_barcode" ON "products" ("barcode");
CREATE INDEX IF NOT EXISTS "idx_products_status" ON "products" ("status");
CREATE INDEX IF NOT EXISTS "idx_products_low_stock" ON "products" ("is_active", "stock", "min_stock");
CREATE INDEX IF NOT EXISTS "idx_sale_items_product" ON "sale_items" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_sale_items_batch" ON "sale_items" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_items_product" ON "purchase_items" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_items_batch" ON "purchase_items" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_print_jobs_product" ON "barcode_print_jobs" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_product_created_at" ON "inventory_movements" ("product_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_journal_lines_account" ON "journal_lines" ("account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sales_idempotency" ON "sales" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_purchases_idempotency" ON "purchases" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_payments_idempotency" ON "payments" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_product_batches_product_expiry" ON "product_batches" ("product_id", "expiry_date");
CREATE INDEX IF NOT EXISTS "idx_product_batches_product_quantity" ON "product_batches" ("product_id", "quantity_on_hand");
CREATE INDEX IF NOT EXISTS "idx_product_batches_expiry_alert_lookup"
  ON "product_batches" ("expiry_date", "product_id")
  WHERE "expiry_date" IS NOT NULL
    AND "quantity_on_hand" > 0
    AND "status" = 'active';
CREATE INDEX IF NOT EXISTS "idx_customer_ledger_customer_created_at" ON "customer_ledger" ("customer_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_supplier_ledger_supplier_created_at" ON "supplier_ledger" ("supplier_id", "created_at");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "__refresh_product_stock_cache"(p_product_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "products" p
  SET
    "stock" = totals.qty_on_hand,
    "updated_at" = now(),
    "status" = CASE
      WHEN p."status" = 'discontinued'::product_status THEN p."status"
      WHEN totals.qty_on_hand <= 0 THEN 'out_of_stock'::product_status
      ELSE 'available'::product_status
    END
  FROM (
    SELECT COALESCE(SUM(pb."quantity_on_hand"), 0)::integer AS qty_on_hand
    FROM "product_batches" pb
    WHERE pb."product_id" = p_product_id
  ) AS totals
  WHERE p."id" = p_product_id;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "sync_product_stock_from_batches"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM "__refresh_product_stock_cache"(NEW."product_id");
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM "__refresh_product_stock_cache"(OLD."product_id");
  ELSE
    PERFORM "__refresh_product_stock_cache"(NEW."product_id");

    IF NEW."product_id" IS DISTINCT FROM OLD."product_id" THEN
      PERFORM "__refresh_product_stock_cache"(OLD."product_id");
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_sync_product_stock_from_batches" ON "product_batches";
CREATE TRIGGER "trg_sync_product_stock_from_batches"
AFTER INSERT OR UPDATE OR DELETE ON "product_batches"
FOR EACH ROW
EXECUTE FUNCTION "sync_product_stock_from_batches"();
--> statement-breakpoint

UPDATE "products" p
SET
  "stock" = totals.qty_on_hand,
  "updated_at" = now(),
  "status" = CASE
    WHEN p."status" = 'discontinued'::product_status THEN p."status"
    WHEN totals.qty_on_hand <= 0 THEN 'out_of_stock'::product_status
    ELSE 'available'::product_status
  END
FROM (
  SELECT pb."product_id", COALESCE(SUM(pb."quantity_on_hand"), 0)::integer AS qty_on_hand
  FROM "product_batches" pb
  GROUP BY pb."product_id"
) AS totals
WHERE p."id" = totals."product_id";
--> statement-breakpoint

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT
      quote_ident(ns.nspname) || '.' || quote_ident(cls.relname) AS qualified_table_name,
      con.conname
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public'
      AND con.contype IN ('c', 'f')
      AND con.convalidated = false
    ORDER BY cls.relname, con.conname
  LOOP
    EXECUTE format(
      'ALTER TABLE %s VALIDATE CONSTRAINT %I',
      rec.qualified_table_name,
      rec.conname
    );
  END LOOP;
END $$;
