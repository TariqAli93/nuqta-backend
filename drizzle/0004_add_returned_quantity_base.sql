-- Track how many base-units of each sold line have already been returned to stock.
-- Used by RefundSaleUseCase to prevent over-return across multiple partial refunds.
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "returned_quantity_base" integer DEFAULT 0 NOT NULL;
