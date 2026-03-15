-- Migration: JWT token revocation table
-- Allows instant logout by recording revoked JTI claims.
-- Expired entries are cleaned up periodically by a background job.

CREATE TABLE IF NOT EXISTS "revoked_tokens" (
  "jti"        UUID        PRIMARY KEY,
  "revoked_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ NOT NULL
);

-- Index for fast expiry-based cleanup
CREATE INDEX IF NOT EXISTS "idx_revoked_tokens_expires_at"
  ON "revoked_tokens" ("expires_at");
