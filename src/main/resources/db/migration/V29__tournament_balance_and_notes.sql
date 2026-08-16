-- ============================================================================
-- V29: Tournament balance payment, host notes
--
-- The host tournament workspace has "Pay balance", "Save notes" and
-- "Regenerate link" controls. Until now none of them had anywhere to write, so
-- they only raised toasts. These columns back the real endpoints:
--   POST  /api/v1/host/tournaments/{code}/balance
--   PATCH /api/v1/host/tournaments/{code}/settings
--   POST  /api/v1/host/tournaments/{code}/invite-code
-- (invite-code regeneration reuses the existing invite_code column.)
-- ============================================================================

ALTER TABLE tournaments ADD COLUMN
IF NOT EXISTS balance_status VARCHAR
(15) NOT NULL DEFAULT 'UNPAID';
ALTER TABLE tournaments ADD COLUMN
IF NOT EXISTS balance_paid_at TIMESTAMP
WITH TIME ZONE;
ALTER TABLE tournaments ADD COLUMN
IF NOT EXISTS balance_amount NUMERIC
(12, 2);
ALTER TABLE tournaments ADD COLUMN
IF NOT EXISTS balance_method VARCHAR
(30);
ALTER TABLE tournaments ADD COLUMN
IF NOT EXISTS balance_reference VARCHAR
(60);
ALTER TABLE tournaments ADD COLUMN
IF NOT EXISTS host_notes VARCHAR
(2000);
