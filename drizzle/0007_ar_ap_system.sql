-- AR/AP system: add paymentStatus to sales, paymentStatus + paymentModeAtCreation to purchases,
-- and create dedicated invoice payment tables.

-- ── Sales ────────────────────────────────────────────────────────────────────
ALTER TABLE "sales" ADD COLUMN "payment_status" text NOT NULL DEFAULT 'unpaid';

UPDATE "sales" SET "payment_status" = CASE
  WHEN "remaining_amount" <= 0 THEN 'paid'
  WHEN "paid_amount" > 0 THEN 'partially_paid'
  ELSE 'unpaid'
END;

-- ── Purchases ─────────────────────────────────────────────────────────────────
ALTER TABLE "purchases" ADD COLUMN "payment_status" text NOT NULL DEFAULT 'unpaid';
ALTER TABLE "purchases" ADD COLUMN "payment_mode_at_creation" text NOT NULL DEFAULT 'credit';

UPDATE "purchases" SET "payment_status" = CASE
  WHEN "remaining_amount" <= 0 THEN 'paid'
  WHEN "paid_amount" > 0 THEN 'partially_paid'
  ELSE 'unpaid'
END;

UPDATE "purchases" SET "payment_mode_at_creation" = CASE
  WHEN "total" <= 0 THEN 'cash'
  WHEN "paid_amount" >= "total" THEN 'cash'
  WHEN "paid_amount" = 0 THEN 'credit'
  ELSE 'partial'
END;

-- ── sales_invoice_payments ────────────────────────────────────────────────────
CREATE TABLE "sales_invoice_payments" (
  "id" serial PRIMARY KEY,
  "invoice_id" integer NOT NULL,
  "customer_id" integer,
  "amount" integer NOT NULL,
  "payment_method" text NOT NULL,
  "reference" text,
  "notes" text,
  "payment_date" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX "idx_sip_invoice" ON "sales_invoice_payments" ("invoice_id");
CREATE INDEX "idx_sip_customer" ON "sales_invoice_payments" ("customer_id");

-- ── purchase_invoice_payments ─────────────────────────────────────────────────
CREATE TABLE "purchase_invoice_payments" (
  "id" serial PRIMARY KEY,
  "invoice_id" integer NOT NULL,
  "supplier_id" integer,
  "amount" integer NOT NULL,
  "payment_method" text NOT NULL,
  "reference" text,
  "notes" text,
  "payment_date" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX "idx_pip_invoice" ON "purchase_invoice_payments" ("invoice_id");
CREATE INDEX "idx_pip_supplier" ON "purchase_invoice_payments" ("supplier_id");
