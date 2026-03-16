-- Migration: Add version columns for optimistic locking
-- Products and product batches need version tracking to prevent lost-update
-- anomalies during concurrent stock depletion.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "product_batches"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
