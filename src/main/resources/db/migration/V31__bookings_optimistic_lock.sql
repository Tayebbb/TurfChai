-- ============================================================================
-- V31: Optimistic locking for bookings
--
-- Confirm and cancel both read a booking, decide on its status, then write.
-- Without a version column two concurrent requests can each decide against the
-- same stale status and the later write silently wins — for example a cancel
-- landing on top of a confirm, leaving a paid booking marked CANCELLED with the
-- slot released and the money taken.
--
-- Existing rows start at 0. Hibernate maintains it from here.
-- ============================================================================

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
