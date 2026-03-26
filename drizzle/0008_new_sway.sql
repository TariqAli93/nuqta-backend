CREATE TABLE "payment_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"sale_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_payment_alloc_payment" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_alloc_sale" ON "payment_allocations" USING btree ("sale_id");