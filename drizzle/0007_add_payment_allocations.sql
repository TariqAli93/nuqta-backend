CREATE TABLE IF NOT EXISTS "payment_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"sale_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_payment_alloc_payment" ON "payment_allocations" USING btree ("payment_id");
CREATE INDEX IF NOT EXISTS "idx_payment_alloc_sale" ON "payment_allocations" USING btree ("sale_id");
