-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 0006: ERP Reconciliation Engine
--
-- Adds the journal-line-based reconciliation tables required for
-- proper double-entry AR/AP matching.  Also backfills three new
-- columns on journal_lines so every line carries its partner and
-- reconciliation state.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Augment journal_lines ────────────────────────────────────
ALTER TABLE "journal_lines"
  ADD COLUMN IF NOT EXISTS "partner_id"        integer,
  ADD COLUMN IF NOT EXISTS "balance"           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reconciled"        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reconciliation_id" integer;
--> statement-breakpoint

-- Backfill balance from existing debit/credit values
UPDATE "journal_lines" SET "balance" = COALESCE("debit", 0) - COALESCE("credit", 0)
WHERE "balance" = 0 AND ("debit" != 0 OR "credit" != 0);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_journal_lines_partner"
  ON "journal_lines" ("partner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_lines_reconciled"
  ON "journal_lines" ("reconciled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_lines_reconciliation"
  ON "journal_lines" ("reconciliation_id");
--> statement-breakpoint

-- ── 2. Create reconciliations (header) ─────────────────────────
CREATE TABLE IF NOT EXISTS "reconciliations" (
  "id"          serial PRIMARY KEY NOT NULL,
  "type"        text    NOT NULL,               -- customer | supplier | account
  "status"      text    NOT NULL DEFAULT 'open',-- open | partially_paid | paid
  "notes"       text,
  "created_at"  timestamp DEFAULT now(),
  "created_by"  integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reconciliations_type"
  ON "reconciliations" ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reconciliations_status"
  ON "reconciliations" ("status");
--> statement-breakpoint

-- ── 3. Create reconciliation_lines (detail) ────────────────────
CREATE TABLE IF NOT EXISTS "reconciliation_lines" (
  "id"                    serial PRIMARY KEY NOT NULL,
  "reconciliation_id"     integer NOT NULL,
  "journal_entry_line_id" integer NOT NULL,
  "amount"                integer NOT NULL,
  "created_at"            timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recon_lines_reconciliation"
  ON "reconciliation_lines" ("reconciliation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recon_lines_journal_line"
  ON "reconciliation_lines" ("journal_entry_line_id");
