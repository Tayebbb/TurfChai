-- ============================================================================
-- V7: Booking slot engine (additive) — extends the V1 slots/bookings tables.
--
-- Review findings from V1__baseline.sql:
--   * slots: status, held_by_user_id, hold_expires_at (the engine's held_until),
--     created_at and updated_at already exist. Only `version` is missing.
--   * bookings: booking_code (UNIQUE, already indexed), status, created_at and
--     updated_at already exist; user_id already exists as booker_user_id.
-- No new tables and no renamed columns; PKs and FKs (payments, booking_members,
-- tournament_bookings reference these tables) are preserved unchanged.
-- ============================================================================

-- slots: optimistic-lock version column (the only missing slot-engine field)
ALTER TABLE slots
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

-- Composite window lookup for slot availability searches
CREATE INDEX IF NOT EXISTS idx_slots_pitch_window
    ON slots (pitch_id, start_time, end_time);

-- Per-user status lookup on bookings (user id column is booker_user_id in V1)
CREATE INDEX IF NOT EXISTS idx_bookings_user_status
    ON bookings (booker_user_id, status);
