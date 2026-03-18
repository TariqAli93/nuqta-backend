-- ═══════════════════════════════════════════════════════════════
-- Migration 0001: Add FK constraints, CHECK constraints,
-- and unique barcode index.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. UNIQUE PARTIAL INDEX: products.barcode ───────────────────
-- Prevent duplicate barcodes across active products.
-- Partial (WHERE barcode IS NOT NULL) avoids blocking products
-- that simply have no barcode set.

CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_barcode_unique"
  ON "products" ("barcode")
  WHERE "barcode" IS NOT NULL;
--> statement-breakpoint

-- ── 2. CHECK CONSTRAINTS — financial amounts ─────────────────────
-- All monetary amounts stored in the DB must be non-negative.

ALTER TABLE "product_batches"
  ADD CONSTRAINT "chk_batches_qty_received_positive"
    CHECK ("quantity_received" > 0) NOT VALID,
  ADD CONSTRAINT "chk_batches_qty_on_hand_nonnegative"
    CHECK ("quantity_on_hand" >= 0) NOT VALID;
--> statement-breakpoint

ALTER TABLE "sales"
  ADD CONSTRAINT "chk_sales_discount_nonneg"    CHECK ("discount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_tax_nonneg"         CHECK ("tax" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_total_nonneg"       CHECK ("total" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_paid_nonneg"        CHECK ("paid_amount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_sales_remaining_nonneg"   CHECK ("remaining_amount" >= 0) NOT VALID;
--> statement-breakpoint

ALTER TABLE "purchases"
  ADD CONSTRAINT "chk_purchases_discount_nonneg"  CHECK ("discount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_tax_nonneg"        CHECK ("tax" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_total_nonneg"      CHECK ("total" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_paid_nonneg"       CHECK ("paid_amount" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_purchases_remaining_nonneg"  CHECK ("remaining_amount" >= 0) NOT VALID;
--> statement-breakpoint

ALTER TABLE "journal_lines"
  ADD CONSTRAINT "chk_jl_debit_nonneg"  CHECK ("debit" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_jl_credit_nonneg" CHECK ("credit" >= 0) NOT VALID,
  ADD CONSTRAINT "chk_jl_nonzero"
    CHECK ("debit" <> 0 OR "credit" <> 0) NOT VALID;
--> statement-breakpoint

-- ── 3. CHECK CONSTRAINTS — transaction_type enumerations ────────
-- customer_ledger and supplier_ledger use text columns; CHECKs
-- enforce the allowed values without requiring a native PG enum.

ALTER TABLE "customer_ledger"
  ADD CONSTRAINT "chk_cust_ledger_txtype" CHECK (
    "transaction_type" IN (
      'sale', 'payment', 'opening_balance', 'adjustment',
      'cancellation', 'refund', 'payment_reversal'
    )
  ) NOT VALID;
--> statement-breakpoint

ALTER TABLE "supplier_ledger"
  ADD CONSTRAINT "chk_supp_ledger_txtype" CHECK (
    "transaction_type" IN (
      'purchase', 'payment', 'opening_balance', 'adjustment',
      'cancellation', 'refund', 'payment_reversal'
    )
  ) NOT VALID;
--> statement-breakpoint

-- ── 4. FOREIGN KEY CONSTRAINTS ───────────────────────────────────
-- Added with NOT VALID so existing rows are not scanned during the
-- migration.  Run VALIDATE CONSTRAINT during a maintenance window.

-- sale_items → sales
ALTER TABLE "sale_items"
  ADD CONSTRAINT "fk_sale_items_sale"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE NOT VALID;
--> statement-breakpoint

-- sale_item_depletions → sales / product_batches
ALTER TABLE "sale_item_depletions"
  ADD CONSTRAINT "fk_sid_sale"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT "fk_sid_batch"
    FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE RESTRICT NOT VALID;
--> statement-breakpoint

-- purchase_items → purchases
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "fk_purchase_items_purchase"
    FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE NOT VALID;
--> statement-breakpoint

-- payments → sales / purchases
ALTER TABLE "payments"
  ADD CONSTRAINT "fk_payments_sale"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT "fk_payments_purchase"
    FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT NOT VALID;
--> statement-breakpoint

-- inventory_movements → product_batches (nullable)
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "fk_inv_mov_batch"
    FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL NOT VALID;
--> statement-breakpoint

-- journal_lines → journal_entries
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "fk_jl_entry"
    FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE NOT VALID;
--> statement-breakpoint

-- journal_entries self-referential (reversal chain)
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "fk_je_reversal_of"
    FOREIGN KEY ("reversal_of_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL NOT VALID;
--> statement-breakpoint

-- customer_ledger → customers / sales / payments
ALTER TABLE "customer_ledger"
  ADD CONSTRAINT "fk_cl_customer"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT "fk_cl_sale"
    FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL NOT VALID,
  ADD CONSTRAINT "fk_cl_payment"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL NOT VALID;
--> statement-breakpoint

-- supplier_ledger → suppliers / purchases / payments
ALTER TABLE "supplier_ledger"
  ADD CONSTRAINT "fk_sl_supplier"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT "fk_sl_purchase"
    FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL NOT VALID,
  ADD CONSTRAINT "fk_sl_payment"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL NOT VALID;
--> statement-breakpoint

-- product_batches → products / purchases
ALTER TABLE "product_batches"
  ADD CONSTRAINT "fk_batches_product"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT "fk_batches_purchase"
    FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL NOT VALID;
--> statement-breakpoint
