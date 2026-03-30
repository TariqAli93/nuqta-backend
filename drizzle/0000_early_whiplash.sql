CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."accounting_cost_method" AS ENUM('fifo', 'weighted_average');--> statement-breakpoint
CREATE TYPE "public"."accounting_rounding_method" AS ENUM('round', 'floor', 'ceil');--> statement-breakpoint
CREATE TYPE "public"."barcode_print_job_status" AS ENUM('pending', 'printed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."barcode_type" AS ENUM('CODE128', 'EAN13', 'EAN8', 'UPC', 'QR');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_reason" AS ENUM('sale', 'purchase', 'return', 'cancellation', 'refund', 'damage', 'manual', 'opening');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('in', 'out', 'adjust');--> statement-breakpoint
CREATE TYPE "public"."journal_source_type" AS ENUM('sale', 'purchase', 'payment', 'adjustment', 'manual', 'sale_cancellation', 'sale_refund', 'payment_reversal', 'credit_note', 'payroll');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'bank_transfer', 'credit', 'refund');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'voided', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'submitted', 'approved', 'disbursed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pos_layout_direction" AS ENUM('rtl', 'ltr');--> statement-breakpoint
CREATE TYPE "public"."pos_paper_size" AS ENUM('thermal', 'a4', 'letter');--> statement-breakpoint
CREATE TYPE "public"."posting_batch_period_type" AS ENUM('day', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."posting_batch_status" AS ENUM('draft', 'posted', 'locked');--> statement-breakpoint
CREATE TYPE "public"."print_status" AS ENUM('pending', 'printed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."product_batch_status" AS ENUM('active', 'expired', 'depleted', 'recalled');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('available', 'out_of_stock', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'completed', 'cancelled', 'received', 'partial');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('open', 'partially_paid', 'paid');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_type" AS ENUM('customer', 'supplier', 'account');--> statement-breakpoint
CREATE TYPE "public"."sale_payment_method" AS ENUM('cash', 'card', 'bank_transfer', 'credit');--> statement-breakpoint
CREATE TYPE "public"."sale_payment_type" AS ENUM('cash', 'credit', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('pending', 'completed', 'cancelled', 'refunded', 'partial_refund');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'cashier');--> statement-breakpoint
CREATE TABLE "accounting_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tax_enabled" boolean DEFAULT false NOT NULL,
	"default_tax_rate" numeric(18, 6) DEFAULT 0 NOT NULL,
	"tax_registration_number" text,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"fiscal_year_start_day" integer DEFAULT 1 NOT NULL,
	"auto_posting" boolean DEFAULT false NOT NULL,
	"cost_method" "accounting_cost_method" DEFAULT 'fifo' NOT NULL,
	"currency_code" text DEFAULT 'IQD' NOT NULL,
	"usd_exchange_rate" numeric(18, 6) DEFAULT 1480 NOT NULL,
	"rounding_method" "accounting_rounding_method" DEFAULT 'round' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "chk_accounting_settings_default_tax_rate_nonnegative" CHECK ("accounting_settings"."default_tax_rate" >= 0),
	CONSTRAINT "chk_accounting_settings_usd_rate_positive" CHECK ("accounting_settings"."usd_exchange_rate" > 0),
	CONSTRAINT "chk_accounting_settings_fiscal_month" CHECK ("accounting_settings"."fiscal_year_start_month" BETWEEN 1 AND 12),
	CONSTRAINT "chk_accounting_settings_fiscal_day" CHECK ("accounting_settings"."fiscal_year_start_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"account_type" "account_type" NOT NULL,
	"parent_id" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"changed_fields" text,
	"change_description" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "barcode_print_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"barcode" text,
	"price" integer,
	"expiry_date" date,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" "barcode_print_job_status" DEFAULT 'pending' NOT NULL,
	"printed_at" timestamp,
	"print_error" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "chk_barcode_print_jobs_quantity_positive" CHECK ("barcode_print_jobs"."quantity" > 0),
	CONSTRAINT "chk_barcode_print_jobs_price_nonnegative" CHECK ("barcode_print_jobs"."price" IS NULL OR "barcode_print_jobs"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "barcode_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"default_barcode_type" "barcode_type" DEFAULT 'CODE128' NOT NULL,
	"default_width" integer DEFAULT 200 NOT NULL,
	"default_height" integer DEFAULT 100 NOT NULL,
	"show_price" boolean DEFAULT true NOT NULL,
	"show_product_name" boolean DEFAULT true NOT NULL,
	"show_expiry_date" boolean DEFAULT false NOT NULL,
	"encoding" text DEFAULT 'UTF-8' NOT NULL,
	"print_dpi" integer DEFAULT 203 NOT NULL,
	"label_width_mm" integer DEFAULT 50 NOT NULL,
	"label_height_mm" integer DEFAULT 30 NOT NULL,
	"margin_top" integer DEFAULT 2 NOT NULL,
	"margin_bottom" integer DEFAULT 2 NOT NULL,
	"margin_left" integer DEFAULT 2 NOT NULL,
	"margin_right" integer DEFAULT 2 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "chk_barcode_settings_default_width_positive" CHECK ("barcode_settings"."default_width" > 0),
	CONSTRAINT "chk_barcode_settings_default_height_positive" CHECK ("barcode_settings"."default_height" > 0),
	CONSTRAINT "chk_barcode_settings_print_dpi_positive" CHECK ("barcode_settings"."print_dpi" > 0),
	CONSTRAINT "chk_barcode_settings_label_width_positive" CHECK ("barcode_settings"."label_width_mm" > 0),
	CONSTRAINT "chk_barcode_settings_label_height_positive" CHECK ("barcode_settings"."label_height_mm" > 0),
	CONSTRAINT "chk_barcode_settings_margin_top_nonnegative" CHECK ("barcode_settings"."margin_top" >= 0),
	CONSTRAINT "chk_barcode_settings_margin_bottom_nonnegative" CHECK ("barcode_settings"."margin_bottom" >= 0),
	CONSTRAINT "chk_barcode_settings_margin_left_nonnegative" CHECK ("barcode_settings"."margin_left" >= 0),
	CONSTRAINT "chk_barcode_settings_margin_right_nonnegative" CHECK ("barcode_settings"."margin_right" >= 0)
);
--> statement-breakpoint
CREATE TABLE "barcode_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"barcode_type" "barcode_type" DEFAULT 'CODE128' NOT NULL,
	"show_price" boolean DEFAULT true NOT NULL,
	"show_name" boolean DEFAULT true NOT NULL,
	"show_barcode" boolean DEFAULT true NOT NULL,
	"show_expiry" boolean DEFAULT false NOT NULL,
	"layout_json" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_barcode_templates_width_positive" CHECK ("barcode_templates"."width" > 0),
	CONSTRAINT "chk_barcode_templates_height_positive" CHECK ("barcode_templates"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "currency_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"currency_code" text NOT NULL,
	"currency_name" text NOT NULL,
	"symbol" text NOT NULL,
	"exchange_rate" numeric(18, 6) NOT NULL,
	"is_base_currency" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "currency_settings_currency_code_unique" UNIQUE("currency_code"),
	CONSTRAINT "chk_currency_settings_exchange_rate_positive" CHECK ("currency_settings"."exchange_rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"sale_id" integer,
	"payment_id" integer,
	"journal_entry_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "chk_customer_ledger_amount_nonnegative" CHECK ("customer_ledger"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"city" text,
	"notes" text,
	"total_purchases" integer DEFAULT 0 NOT NULL,
	"total_debt" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"salary" integer NOT NULL,
	"position" text NOT NULL,
	"department_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "chk_employees_salary_nonnegative" CHECK ("employees"."salary" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"batch_id" integer,
	"movement_type" "inventory_movement_type" NOT NULL,
	"reason" "inventory_movement_reason" NOT NULL,
	"quantity_base" integer NOT NULL,
	"unit_name" text DEFAULT 'piece' NOT NULL,
	"unit_factor" integer DEFAULT 1 NOT NULL,
	"stock_before" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"cost_per_unit" integer,
	"total_cost" integer,
	"source_type" text,
	"source_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "chk_inventory_movements_quantity_nonzero" CHECK ("inventory_movements"."quantity_base" <> 0),
	CONSTRAINT "chk_inventory_movements_unit_factor_positive" CHECK ("inventory_movements"."unit_factor" >= 1),
	CONSTRAINT "chk_inventory_movements_cost_per_unit_nonnegative" CHECK ("inventory_movements"."cost_per_unit" IS NULL OR "inventory_movements"."cost_per_unit" >= 0),
	CONSTRAINT "chk_inventory_movements_total_cost_nonnegative" CHECK ("inventory_movements"."total_cost" IS NULL OR "inventory_movements"."total_cost" >= 0),
	CONSTRAINT "chk_inventory_movements_stock_before_nonnegative" CHECK ("inventory_movements"."stock_before" >= 0),
	CONSTRAINT "chk_inventory_movements_stock_after_nonnegative" CHECK ("inventory_movements"."stock_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_number" text NOT NULL,
	"entry_date" timestamp DEFAULT now() NOT NULL,
	"description" text NOT NULL,
	"source_type" "journal_source_type",
	"source_id" integer,
	"is_posted" boolean DEFAULT false NOT NULL,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversal_of_id" integer,
	"posting_batch_id" integer,
	"total_amount" integer NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "journal_entries_entry_number_unique" UNIQUE("entry_number"),
	CONSTRAINT "chk_journal_entries_total_nonnegative" CHECK ("journal_entries"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_entry_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"partner_id" integer,
	"debit" integer DEFAULT 0 NOT NULL,
	"credit" integer DEFAULT 0 NOT NULL,
	"balance" integer GENERATED ALWAYS AS (COALESCE("debit", 0) - COALESCE("credit", 0)) STORED,
	"description" text,
	"reconciled" boolean DEFAULT false NOT NULL,
	"reconciliation_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_journal_lines_debit_nonnegative" CHECK ("journal_lines"."debit" >= 0),
	CONSTRAINT "chk_journal_lines_credit_nonnegative" CHECK ("journal_lines"."credit" >= 0),
	CONSTRAINT "chk_journal_lines_exactly_one_side" CHECK ((("journal_lines"."debit" > 0 AND "journal_lines"."credit" = 0) OR ("journal_lines"."credit" > 0 AND "journal_lines"."debit" = 0)))
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"sale_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_payment_allocations_amount_positive" CHECK ("payment_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer,
	"purchase_id" integer,
	"customer_id" integer,
	"supplier_id" integer,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"exchange_rate" numeric(18, 6) DEFAULT 1 NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference_number" text,
	"idempotency_key" text,
	"status" "payment_status" DEFAULT 'completed' NOT NULL,
	"payment_date" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "chk_payments_exchange_rate_positive" CHECK ("payments"."exchange_rate" > 0),
	CONSTRAINT "chk_payments_amount_nonzero" CHECK ("payments"."amount" <> 0),
	CONSTRAINT "chk_payments_no_sale_and_purchase" CHECK (NOT ("payments"."sale_id" IS NOT NULL AND "payments"."purchase_id" IS NOT NULL)),
	CONSTRAINT "chk_payments_no_customer_and_supplier" CHECK (NOT ("payments"."customer_id" IS NOT NULL AND "payments"."supplier_id" IS NOT NULL)),
	CONSTRAINT "chk_payments_no_sale_and_supplier" CHECK (NOT ("payments"."sale_id" IS NOT NULL AND "payments"."supplier_id" IS NOT NULL)),
	CONSTRAINT "chk_payments_no_purchase_and_customer" CHECK (NOT ("payments"."purchase_id" IS NOT NULL AND "payments"."customer_id" IS NOT NULL)),
	CONSTRAINT "chk_payments_has_context" CHECK (("payments"."sale_id" IS NOT NULL OR "payments"."purchase_id" IS NOT NULL OR "payments"."customer_id" IS NOT NULL OR "payments"."supplier_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payroll_run_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"employee_name" text NOT NULL,
	"position" text NOT NULL,
	"department_name" text NOT NULL,
	"gross_pay" integer NOT NULL,
	"deductions" integer DEFAULT 0 NOT NULL,
	"bonuses" integer DEFAULT 0 NOT NULL,
	"net_pay" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_payroll_run_items_gross_nonnegative" CHECK ("payroll_run_items"."gross_pay" >= 0),
	CONSTRAINT "chk_payroll_run_items_deductions_nonnegative" CHECK ("payroll_run_items"."deductions" >= 0),
	CONSTRAINT "chk_payroll_run_items_bonuses_nonnegative" CHECK ("payroll_run_items"."bonuses" >= 0),
	CONSTRAINT "chk_payroll_run_items_net_nonnegative" CHECK ("payroll_run_items"."net_pay" >= 0),
	CONSTRAINT "chk_payroll_run_items_totals_consistent" CHECK ("payroll_run_items"."net_pay" = "payroll_run_items"."gross_pay" - "payroll_run_items"."deductions" + "payroll_run_items"."bonuses")
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"payment_date" timestamp,
	"status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
	"total_gross_pay" integer DEFAULT 0 NOT NULL,
	"total_deductions" integer DEFAULT 0 NOT NULL,
	"total_bonuses" integer DEFAULT 0 NOT NULL,
	"total_net_pay" integer DEFAULT 0 NOT NULL,
	"salary_expense_account_code" text NOT NULL,
	"deductions_liability_account_code" text NOT NULL,
	"payment_account_code" text NOT NULL,
	"journal_entry_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	"approved_at" timestamp,
	"approved_by" integer,
	CONSTRAINT "chk_payroll_runs_period_year" CHECK ("payroll_runs"."period_year" BETWEEN 2000 AND 9999),
	CONSTRAINT "chk_payroll_runs_period_month" CHECK ("payroll_runs"."period_month" BETWEEN 1 AND 12),
	CONSTRAINT "chk_payroll_runs_gross_nonnegative" CHECK ("payroll_runs"."total_gross_pay" >= 0),
	CONSTRAINT "chk_payroll_runs_deductions_nonnegative" CHECK ("payroll_runs"."total_deductions" >= 0),
	CONSTRAINT "chk_payroll_runs_bonuses_nonnegative" CHECK ("payroll_runs"."total_bonuses" >= 0),
	CONSTRAINT "chk_payroll_runs_net_nonnegative" CHECK ("payroll_runs"."total_net_pay" >= 0),
	CONSTRAINT "chk_payroll_runs_totals_consistent" CHECK ("payroll_runs"."total_net_pay" = "payroll_runs"."total_gross_pay" - "payroll_runs"."total_deductions" + "payroll_runs"."total_bonuses")
);
--> statement-breakpoint
CREATE TABLE "pos_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"invoice_template_id" text DEFAULT 'default' NOT NULL,
	"paper_size" "pos_paper_size" DEFAULT 'thermal' NOT NULL,
	"layout_direction" "pos_layout_direction" DEFAULT 'rtl' NOT NULL,
	"show_qr" boolean DEFAULT false NOT NULL,
	"show_barcode" boolean DEFAULT false NOT NULL,
	"invoice_logo" text DEFAULT '' NOT NULL,
	"invoice_footer_notes" text DEFAULT '' NOT NULL,
	"default_printer_name" text,
	"receipt_header" text,
	"receipt_footer" text,
	"quick_sale_enabled" boolean DEFAULT true NOT NULL,
	"sound_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "posting_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_type" "posting_batch_period_type" DEFAULT 'day' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"entries_count" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"status" "posting_batch_status" DEFAULT 'posted' NOT NULL,
	"posted_at" timestamp DEFAULT now() NOT NULL,
	"posted_by" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_posting_batches_entries_nonnegative" CHECK ("posting_batches"."entries_count" >= 0),
	CONSTRAINT "chk_posting_batches_total_nonnegative" CHECK ("posting_batches"."total_amount" >= 0),
	CONSTRAINT "chk_posting_batches_period_order" CHECK ("posting_batches"."period_end" >= "posting_batches"."period_start")
);
--> statement-breakpoint
CREATE TABLE "product_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"batch_number" text NOT NULL,
	"expiry_date" date,
	"manufacturing_date" date,
	"quantity_received" integer NOT NULL,
	"quantity_on_hand" integer NOT NULL,
	"cost_per_unit" integer,
	"purchase_id" integer,
	"status" "product_batch_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_batches_qty_received_nonnegative" CHECK ("product_batches"."quantity_received" >= 0),
	CONSTRAINT "chk_batches_qty_on_hand_nonnegative" CHECK ("product_batches"."quantity_on_hand" >= 0),
	CONSTRAINT "chk_batches_cost_per_unit_nonnegative" CHECK ("product_batches"."cost_per_unit" IS NULL OR "product_batches"."cost_per_unit" >= 0),
	CONSTRAINT "chk_batches_version_positive" CHECK ("product_batches"."version" >= 1),
	CONSTRAINT "chk_batches_expiry_after_manufacture" CHECK ("product_batches"."expiry_date" IS NULL OR "product_batches"."manufacturing_date" IS NULL OR "product_batches"."expiry_date" >= "product_batches"."manufacturing_date")
);
--> statement-breakpoint
CREATE TABLE "product_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"unit_name" text NOT NULL,
	"factor_to_base" integer DEFAULT 1 NOT NULL,
	"barcode" text,
	"selling_price" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_product_units_factor_positive" CHECK ("product_units"."factor_to_base" >= 1),
	CONSTRAINT "chk_product_units_selling_price_nonnegative" CHECK ("product_units"."selling_price" IS NULL OR "product_units"."selling_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"barcode" text,
	"category_id" integer,
	"description" text,
	"cost_price" integer NOT NULL,
	"selling_price" integer NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"supplier_id" integer,
	"track_expiry" boolean DEFAULT false NOT NULL,
	"status" "product_status" DEFAULT 'available' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "chk_products_cost_price_nonnegative" CHECK ("products"."cost_price" >= 0),
	CONSTRAINT "chk_products_selling_price_nonnegative" CHECK ("products"."selling_price" >= 0),
	CONSTRAINT "chk_products_stock_nonnegative" CHECK ("products"."stock" >= 0),
	CONSTRAINT "chk_products_min_stock_nonnegative" CHECK ("products"."min_stock" >= 0),
	CONSTRAINT "chk_products_version_positive" CHECK ("products"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"unit_name" text DEFAULT 'piece' NOT NULL,
	"unit_factor" integer DEFAULT 1 NOT NULL,
	"quantity" integer NOT NULL,
	"quantity_base" integer NOT NULL,
	"unit_cost" integer NOT NULL,
	"line_subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"batch_id" integer,
	"expiry_date" date,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_purchase_items_quantity_positive" CHECK ("purchase_items"."quantity" > 0),
	CONSTRAINT "chk_purchase_items_unit_factor_positive" CHECK ("purchase_items"."unit_factor" >= 1),
	CONSTRAINT "chk_purchase_items_quantity_base_positive" CHECK ("purchase_items"."quantity_base" > 0),
	CONSTRAINT "chk_purchase_items_unit_cost_nonnegative" CHECK ("purchase_items"."unit_cost" >= 0),
	CONSTRAINT "chk_purchase_items_discount_nonnegative" CHECK ("purchase_items"."discount" >= 0),
	CONSTRAINT "chk_purchase_items_line_subtotal_nonnegative" CHECK ("purchase_items"."line_subtotal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"supplier_id" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"remaining_amount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"exchange_rate" numeric(18, 6) DEFAULT 1 NOT NULL,
	"status" "purchase_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"received_at" timestamp,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "chk_purchases_subtotal_nonnegative" CHECK ("purchases"."subtotal" >= 0),
	CONSTRAINT "chk_purchases_discount_nonnegative" CHECK ("purchases"."discount" >= 0),
	CONSTRAINT "chk_purchases_tax_nonnegative" CHECK ("purchases"."tax" >= 0),
	CONSTRAINT "chk_purchases_total_nonnegative" CHECK ("purchases"."total" >= 0),
	CONSTRAINT "chk_purchases_paid_nonnegative" CHECK ("purchases"."paid_amount" >= 0),
	CONSTRAINT "chk_purchases_remaining_nonnegative" CHECK ("purchases"."remaining_amount" >= 0),
	CONSTRAINT "chk_purchases_exchange_rate_positive" CHECK ("purchases"."exchange_rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "reconciliation_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"reconciliation_id" integer NOT NULL,
	"journal_entry_line_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_reconciliation_lines_amount_positive" CHECK ("reconciliation_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "reconciliation_type" NOT NULL,
	"status" "reconciliation_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "revoked_tokens" (
	"jti" uuid PRIMARY KEY NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_item_depletions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"sale_item_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"batch_id" integer NOT NULL,
	"quantity_base" integer NOT NULL,
	"cost_per_unit" integer NOT NULL,
	"total_cost" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_sale_item_depletions_quantity_positive" CHECK ("sale_item_depletions"."quantity_base" > 0),
	CONSTRAINT "chk_sale_item_depletions_cost_nonnegative" CHECK ("sale_item_depletions"."cost_per_unit" >= 0),
	CONSTRAINT "chk_sale_item_depletions_total_nonnegative" CHECK ("sale_item_depletions"."total_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_name" text DEFAULT 'piece' NOT NULL,
	"unit_factor" integer DEFAULT 1 NOT NULL,
	"quantity_base" integer,
	"batch_id" integer,
	"unit_price" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"subtotal" integer NOT NULL,
	"returned_quantity_base" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chk_sale_items_quantity_positive" CHECK ("sale_items"."quantity" > 0),
	CONSTRAINT "chk_sale_items_unit_factor_positive" CHECK ("sale_items"."unit_factor" >= 1),
	CONSTRAINT "chk_sale_items_quantity_base_positive" CHECK ("sale_items"."quantity_base" IS NULL OR "sale_items"."quantity_base" > 0),
	CONSTRAINT "chk_sale_items_unit_price_nonnegative" CHECK ("sale_items"."unit_price" >= 0),
	CONSTRAINT "chk_sale_items_discount_nonnegative" CHECK ("sale_items"."discount" >= 0),
	CONSTRAINT "chk_sale_items_subtotal_nonnegative" CHECK ("sale_items"."subtotal" >= 0),
	CONSTRAINT "chk_sale_items_returned_quantity_nonnegative" CHECK ("sale_items"."returned_quantity_base" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" integer,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"exchange_rate" numeric(18, 6) DEFAULT 1 NOT NULL,
	"interest_rate" numeric(18, 6) DEFAULT 0 NOT NULL,
	"interest_amount" integer DEFAULT 0 NOT NULL,
	"payment_type" "sale_payment_type" NOT NULL,
	"payment_method" "sale_payment_method" DEFAULT 'cash' NOT NULL,
	"reference_number" text,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"remaining_amount" integer DEFAULT 0 NOT NULL,
	"status" "sale_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"idempotency_key" text,
	"print_status" "print_status" DEFAULT 'pending' NOT NULL,
	"printed_at" timestamp,
	"print_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "sales_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "chk_sales_subtotal_nonnegative" CHECK ("sales"."subtotal" >= 0),
	CONSTRAINT "chk_sales_discount_nonnegative" CHECK ("sales"."discount" >= 0),
	CONSTRAINT "chk_sales_tax_nonnegative" CHECK ("sales"."tax" >= 0),
	CONSTRAINT "chk_sales_total_nonnegative" CHECK ("sales"."total" >= 0),
	CONSTRAINT "chk_sales_paid_nonnegative" CHECK ("sales"."paid_amount" >= 0),
	CONSTRAINT "chk_sales_refunded_nonnegative" CHECK ("sales"."refunded_amount" >= 0),
	CONSTRAINT "chk_sales_remaining_nonnegative" CHECK ("sales"."remaining_amount" >= 0),
	CONSTRAINT "chk_sales_exchange_rate_positive" CHECK ("sales"."exchange_rate" > 0),
	CONSTRAINT "chk_sales_interest_rate_nonnegative" CHECK ("sales"."interest_rate" >= 0),
	CONSTRAINT "chk_sales_interest_amount_nonnegative" CHECK ("sales"."interest_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "supplier_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"purchase_id" integer,
	"payment_id" integer,
	"journal_entry_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "chk_supplier_ledger_amount_nonnegative" CHECK ("supplier_ledger"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"phone2" text,
	"address" text,
	"city" text,
	"notes" text,
	"opening_balance" integer DEFAULT 0 NOT NULL,
	"current_balance" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer,
	CONSTRAINT "chk_suppliers_opening_balance_nonnegative" CHECK ("suppliers"."opening_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"company_address" text,
	"company_phone" text,
	"company_phone2" text,
	"company_email" text,
	"company_tax_id" text,
	"company_logo" text,
	"default_currency" text DEFAULT 'IQD' NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"accounting_enabled" boolean DEFAULT false NOT NULL,
	"purchases_enabled" boolean DEFAULT true NOT NULL,
	"ledgers_enabled" boolean DEFAULT true NOT NULL,
	"units_enabled" boolean DEFAULT false NOT NULL,
	"payments_on_invoices_enabled" boolean DEFAULT true NOT NULL,
	"expiry_alert_days" integer DEFAULT 30 NOT NULL,
	"debt_reminder_count" integer DEFAULT 3 NOT NULL,
	"debt_reminder_interval_days" integer DEFAULT 7 NOT NULL,
	"setup_wizard_completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "chk_system_settings_low_stock_threshold_nonnegative" CHECK ("system_settings"."low_stock_threshold" >= 0),
	CONSTRAINT "chk_system_settings_expiry_alert_days_nonnegative" CHECK ("system_settings"."expiry_alert_days" >= 0),
	CONSTRAINT "chk_system_settings_debt_reminder_count_nonnegative" CHECK ("system_settings"."debt_reminder_count" >= 0),
	CONSTRAINT "chk_system_settings_debt_interval_nonnegative" CHECK ("system_settings"."debt_reminder_interval_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"role" "user_role" DEFAULT 'cashier' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "accounting_settings" ADD CONSTRAINT "accounting_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "barcode_print_jobs" ADD CONSTRAINT "barcode_print_jobs_template_id_barcode_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."barcode_templates"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "barcode_print_jobs" ADD CONSTRAINT "barcode_print_jobs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "barcode_print_jobs" ADD CONSTRAINT "barcode_print_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "barcode_settings" ADD CONSTRAINT "barcode_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_ledger" ADD CONSTRAINT "customer_ledger_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_ledger" ADD CONSTRAINT "customer_ledger_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_ledger" ADD CONSTRAINT "customer_ledger_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_ledger" ADD CONSTRAINT "customer_ledger_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_ledger" ADD CONSTRAINT "customer_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_id_journal_entries_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posting_batch_id_posting_batches_id_fk" FOREIGN KEY ("posting_batch_id") REFERENCES "public"."posting_batches"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_reconciliation_id_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."reconciliations"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD CONSTRAINT "pos_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posting_batches" ADD CONSTRAINT "posting_batches_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reconciliation_lines" ADD CONSTRAINT "reconciliation_lines_reconciliation_id_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."reconciliations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reconciliation_lines" ADD CONSTRAINT "reconciliation_lines_journal_entry_line_id_journal_lines_id_fk" FOREIGN KEY ("journal_entry_line_id") REFERENCES "public"."journal_lines"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sale_item_depletions" ADD CONSTRAINT "sale_item_depletions_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sale_item_depletions" ADD CONSTRAINT "sale_item_depletions_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sale_item_depletions" ADD CONSTRAINT "sale_item_depletions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sale_item_depletions" ADD CONSTRAINT "sale_item_depletions_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_print_jobs_status" ON "barcode_print_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_print_jobs_product" ON "barcode_print_jobs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_cust_ledger_customer" ON "customer_ledger" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_cust_ledger_date" ON "customer_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_customer_ledger_customer_created_at" ON "customer_ledger" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_departments_name" ON "departments" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_departments_active" ON "departments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_employees_name" ON "employees" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_employees_department" ON "employees" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_employees_active" ON "employees" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_inv_mov_product" ON "inventory_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_inv_mov_batch" ON "inventory_movements" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_inv_mov_date" ON "inventory_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_product_created_at" ON "inventory_movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_inv_mov_source" ON "inventory_movements" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_journal_date" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "idx_journal_source" ON "journal_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_journal_posting_batch" ON "journal_entries" USING btree ("posting_batch_id");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_entry" ON "journal_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_account" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_partner" ON "journal_lines" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_reconciled" ON "journal_lines" USING btree ("reconciled");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_reconciliation" ON "journal_lines" USING btree ("reconciliation_id");--> statement-breakpoint
CREATE INDEX "idx_payment_alloc_payment" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_alloc_sale" ON "payment_allocations" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_payments_sale" ON "payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_payments_purchase" ON "payments" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "idx_payments_customer" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_payments_supplier" ON "payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payments_idempotency" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_items_run" ON "payroll_run_items" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_items_employee" ON "payroll_run_items" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payroll_run_items_unique" ON "payroll_run_items" USING btree ("payroll_run_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payroll_runs_period" ON "payroll_runs" USING btree ("period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_payroll_runs_status" ON "payroll_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_posting_batches_period" ON "posting_batches" USING btree ("period_type","period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_batches_product" ON "product_batches" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_batches_expiry" ON "product_batches" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_product_batches_product_expiry" ON "product_batches" USING btree ("product_id","expiry_date");--> statement-breakpoint
CREATE INDEX "idx_product_batches_product_quantity" ON "product_batches" USING btree ("product_id","quantity_on_hand");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_batches_unique" ON "product_batches" USING btree ("product_id","batch_number");--> statement-breakpoint
CREATE INDEX "idx_product_units_product" ON "product_units" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_units_unique" ON "product_units" USING btree ("product_id","unit_name");--> statement-breakpoint
CREATE INDEX "idx_products_barcode" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_products_supplier" ON "products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_products_status" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_products_low_stock" ON "products" USING btree ("is_active","stock","min_stock");--> statement-breakpoint
CREATE INDEX "idx_purchase_items_purchase" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_items_product" ON "purchase_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_items_batch" ON "purchase_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_supplier" ON "purchases" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_status" ON "purchases" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_purchases_invoice_supplier" ON "purchases" USING btree ("invoice_number","supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_purchases_idempotency" ON "purchases" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_recon_lines_reconciliation" ON "reconciliation_lines" USING btree ("reconciliation_id");--> statement-breakpoint
CREATE INDEX "idx_recon_lines_journal_line" ON "reconciliation_lines" USING btree ("journal_entry_line_id");--> statement-breakpoint
CREATE INDEX "idx_reconciliations_type" ON "reconciliations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_reconciliations_status" ON "reconciliations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_revoked_tokens_expires_at" ON "revoked_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_sale_item_depletions_sale" ON "sale_item_depletions" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_sale_item_depletions_item" ON "sale_item_depletions" USING btree ("sale_item_id");--> statement-breakpoint
CREATE INDEX "idx_sale_item_depletions_batch" ON "sale_item_depletions" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sale_item_depletions_unique" ON "sale_item_depletions" USING btree ("sale_item_id","batch_id");--> statement-breakpoint
CREATE INDEX "idx_sale_items_sale" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_sale_items_product" ON "sale_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_sale_items_batch" ON "sale_items" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sales_idempotency" ON "sales" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_sales_customer" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_status" ON "sales" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sales_created_at" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_supp_ledger_supplier" ON "supplier_ledger" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supp_ledger_date" ON "supplier_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_ledger_supplier_created_at" ON "supplier_ledger" USING btree ("supplier_id","created_at");
-- =============================
-- STOCK CACHE TRIGGER
-- =============================

CREATE OR REPLACE FUNCTION __refresh_product_stock_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE products p
    SET stock = COALESCE((
      SELECT SUM(pb.quantity_on_hand)
      FROM product_batches pb
      WHERE pb.product_id = OLD.product_id
    ), 0)
    WHERE p.id = OLD.product_id;

    RETURN OLD;
  END IF;

  UPDATE products p
  SET stock = COALESCE((
    SELECT SUM(pb.quantity_on_hand)
    FROM product_batches pb
    WHERE pb.product_id = NEW.product_id
  ), 0)
  WHERE p.id = NEW.product_id;

  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    UPDATE products p
    SET stock = COALESCE((
      SELECT SUM(pb.quantity_on_hand)
      FROM product_batches pb
      WHERE pb.product_id = OLD.product_id
    ), 0)
    WHERE p.id = OLD.product_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refresh_product_stock_cache
AFTER INSERT OR UPDATE OR DELETE
ON product_batches
FOR EACH ROW
EXECUTE FUNCTION __refresh_product_stock_cache();