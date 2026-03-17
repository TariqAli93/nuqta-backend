CREATE TABLE "accounting_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tax_enabled" boolean DEFAULT false NOT NULL,
	"default_tax_rate" real DEFAULT 0 NOT NULL,
	"tax_registration_number" text,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"fiscal_year_start_day" integer DEFAULT 1 NOT NULL,
	"auto_posting" boolean DEFAULT false NOT NULL,
	"cost_method" text DEFAULT 'fifo' NOT NULL,
	"currency_code" text DEFAULT 'IQD' NOT NULL,
	"usd_exchange_rate" real DEFAULT 1480 NOT NULL,
	"rounding_method" text DEFAULT 'round' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "barcode_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"default_barcode_type" text DEFAULT 'CODE128' NOT NULL,
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
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"salary" integer NOT NULL,
	"position" text NOT NULL,
	"department" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "payroll_run_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"employee_name" text NOT NULL,
	"position" text NOT NULL,
	"department" text NOT NULL,
	"gross_pay" integer NOT NULL,
	"deductions" integer DEFAULT 0 NOT NULL,
	"bonuses" integer DEFAULT 0 NOT NULL,
	"net_pay" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"payment_date" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
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
	"approved_by" integer
);
--> statement-breakpoint
CREATE TABLE "pos_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"invoice_template_id" text DEFAULT 'default' NOT NULL,
	"paper_size" text DEFAULT 'thermal' NOT NULL,
	"layout_direction" text DEFAULT 'rtl' NOT NULL,
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
CREATE TABLE "reconciliation_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"reconciliation_id" integer NOT NULL,
	"journal_entry_line_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
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
	"updated_by" integer
);
--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN "partner_id" integer;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN "balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN "reconciled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN "reconciliation_id" integer;--> statement-breakpoint
ALTER TABLE "product_batches" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_employees_name" ON "employees" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_employees_department" ON "employees" USING btree ("department");--> statement-breakpoint
CREATE INDEX "idx_employees_active" ON "employees" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_items_run" ON "payroll_run_items" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_items_employee" ON "payroll_run_items" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payroll_run_items_unique" ON "payroll_run_items" USING btree ("payroll_run_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payroll_runs_period" ON "payroll_runs" USING btree ("period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_payroll_runs_status" ON "payroll_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recon_lines_reconciliation" ON "reconciliation_lines" USING btree ("reconciliation_id");--> statement-breakpoint
CREATE INDEX "idx_recon_lines_journal_line" ON "reconciliation_lines" USING btree ("journal_entry_line_id");--> statement-breakpoint
CREATE INDEX "idx_reconciliations_type" ON "reconciliations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_reconciliations_status" ON "reconciliations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_revoked_tokens_expires_at" ON "revoked_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_partner" ON "journal_lines" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_reconciled" ON "journal_lines" USING btree ("reconciled");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_reconciliation" ON "journal_lines" USING btree ("reconciliation_id");