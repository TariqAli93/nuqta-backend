-- ═══════════════════════════════════════════════════════════════
-- SYSTEM SETTINGS (Singleton — general system configuration)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "system_settings" (
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

-- ═══════════════════════════════════════════════════════════════
-- ACCOUNTING SETTINGS (Singleton — accounting configuration)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "accounting_settings" (
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

-- ═══════════════════════════════════════════════════════════════
-- POS SETTINGS (Singleton — point-of-sale configuration)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "pos_settings" (
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

-- ═══════════════════════════════════════════════════════════════
-- BARCODE SETTINGS (Singleton — barcode configuration)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "barcode_settings" (
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

-- ═══════════════════════════════════════════════════════════════
-- MIGRATE EXISTING DATA: Seed singleton rows with defaults
-- ═══════════════════════════════════════════════════════════════

-- Seed system_settings from existing KV settings table if data exists
INSERT INTO "system_settings" (
	"company_name", "company_address", "company_phone", "company_phone2",
	"company_email", "company_tax_id", "company_logo", "default_currency",
	"low_stock_threshold", "accounting_enabled", "purchases_enabled",
	"ledgers_enabled", "units_enabled", "payments_on_invoices_enabled",
	"expiry_alert_days", "debt_reminder_count", "debt_reminder_interval_days",
	"setup_wizard_completed"
)
SELECT
	COALESCE(MAX(CASE WHEN key = 'company_name' THEN value END), ''),
	MAX(CASE WHEN key = 'company_address' THEN value END),
	MAX(CASE WHEN key = 'company_phone' THEN value END),
	MAX(CASE WHEN key = 'company_phone2' THEN value END),
	MAX(CASE WHEN key = 'company_email' THEN value END),
	MAX(CASE WHEN key = 'company_tax_id' THEN value END),
	MAX(CASE WHEN key = 'company_logo' THEN value END),
	COALESCE(MAX(CASE WHEN key = 'default_currency' THEN value END), 'IQD'),
	COALESCE(MAX(CASE WHEN key = 'low_stock_threshold' THEN value END)::integer, 5),
	COALESCE(MAX(CASE WHEN key IN ('accounting.enabled', 'modules.accounting.enabled') THEN value END), 'false') = 'true',
	COALESCE(MAX(CASE WHEN key IN ('purchases.enabled', 'modules.purchases.enabled') THEN value END), 'true') = 'true',
	COALESCE(MAX(CASE WHEN key IN ('ledgers.enabled', 'modules.ledgers.enabled') THEN value END), 'true') = 'true',
	COALESCE(MAX(CASE WHEN key IN ('units.enabled', 'modules.units.enabled') THEN value END), 'false') = 'true',
	COALESCE(MAX(CASE WHEN key IN ('paymentsOnInvoices.enabled', 'modules.payments_on_invoices.enabled') THEN value END), 'true') = 'true',
	COALESCE(MAX(CASE WHEN key IN ('notifications.expiryDays', 'notifications.expiry_days') THEN value END)::integer, 30),
	COALESCE(MAX(CASE WHEN key = 'notifications.debtReminderCount' THEN value END)::integer, 3),
	COALESCE(MAX(CASE WHEN key IN ('notifications.debtReminderIntervalDays', 'notifications.debt_reminder_interval') THEN value END)::integer, 7),
	COALESCE(MAX(CASE WHEN key IN ('setup.wizardCompleted', 'setup.wizard_completed') THEN value END), 'false') = 'true'
FROM "settings"
WHERE EXISTS (SELECT 1 FROM "settings" LIMIT 1);
--> statement-breakpoint

-- If no data was migrated (no settings rows), insert a default row
INSERT INTO "system_settings" ("company_name")
SELECT ''
WHERE NOT EXISTS (SELECT 1 FROM "system_settings");
--> statement-breakpoint

-- Seed accounting_settings with defaults
INSERT INTO "accounting_settings" ("tax_enabled") VALUES (false);
--> statement-breakpoint

-- Seed pos_settings from existing invoice settings
INSERT INTO "pos_settings" (
	"invoice_prefix", "invoice_template_id", "paper_size", "layout_direction",
	"show_qr", "show_barcode", "invoice_logo", "invoice_footer_notes"
)
SELECT
	COALESCE(MAX(CASE WHEN key IN ('invoice.series.prefix', 'invoice.prefix') THEN value END), 'INV'),
	COALESCE(MAX(CASE WHEN key = 'invoice.template.activeId' THEN value END), 'default'),
	COALESCE(MAX(CASE WHEN key IN ('invoice.paperSize', 'invoice.paper_size') THEN value END), 'thermal'),
	COALESCE(MAX(CASE WHEN key = 'invoice.layoutDirection' THEN value END), 'rtl'),
	COALESCE(MAX(CASE WHEN key IN ('invoice.showQr', 'invoice.show_qr') THEN value END), 'false') = 'true',
	COALESCE(MAX(CASE WHEN key = 'invoice.showBarcode' THEN value END), 'false') = 'true',
	COALESCE(MAX(CASE WHEN key = 'invoice.logo' THEN value END), ''),
	COALESCE(MAX(CASE WHEN key IN ('invoice.footerNotes', 'invoice.footer_notes') THEN value END), '')
FROM "settings"
WHERE EXISTS (SELECT 1 FROM "settings" LIMIT 1);
--> statement-breakpoint

-- If no data was migrated, insert defaults
INSERT INTO "pos_settings" ("invoice_prefix")
SELECT 'INV'
WHERE NOT EXISTS (SELECT 1 FROM "pos_settings");
--> statement-breakpoint

-- Seed barcode_settings with defaults
INSERT INTO "barcode_settings" ("default_barcode_type") VALUES ('CODE128');
