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
CREATE INDEX "idx_employees_name" ON "employees" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_employees_department" ON "employees" USING btree ("department");--> statement-breakpoint
CREATE INDEX "idx_employees_active" ON "employees" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payroll_runs_period" ON "payroll_runs" USING btree ("period_year","period_month");--> statement-breakpoint
CREATE INDEX "idx_payroll_runs_status" ON "payroll_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_items_run" ON "payroll_run_items" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_items_employee" ON "payroll_run_items" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payroll_run_items_unique" ON "payroll_run_items" USING btree ("payroll_run_id","employee_id");
