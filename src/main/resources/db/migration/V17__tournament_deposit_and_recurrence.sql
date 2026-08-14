-- ============================================================================
-- V17: Deposit capture + weekly recurrence for bulk pitch reservations
-- Backs POST /api/v1/host/tournaments/{code}/deposit. The amount is never
-- stored from the client: deposit_amount is recomputed server-side from the
-- reserved slots before this row is written.
-- ============================================================================

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(15) NOT NULL DEFAULT 'UNPAID';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS deposit_method VARCHAR(30);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS deposit_reference VARCHAR(60);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS repeat_weeks INTEGER NOT NULL DEFAULT 1;

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_tournaments_deposit_status;
ALTER TABLE tournaments ADD CONSTRAINT chk_tournaments_deposit_status
    CHECK (deposit_status IN ('UNPAID', 'PAID'));

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS chk_tournaments_repeat_weeks;
ALTER TABLE tournaments ADD CONSTRAINT chk_tournaments_repeat_weeks
    CHECK (repeat_weeks BETWEEN 1 AND 26);
