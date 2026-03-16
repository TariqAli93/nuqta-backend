-- Migration: Add status column to payroll_runs for the state machine
-- Valid states: draft | submitted | approved | disbursed | cancelled

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'approved';

-- Existing records are assumed to be in the 'approved' state since
-- ApprovePayrollRunUseCase was the final step before this migration.
