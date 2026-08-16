-- ============================================================================
-- V9: Enforce at most one active booking per slot at the database level
--
-- The application's pessimistic row lock (SlotRepository#findByIdForUpdate)
-- plus the optimistic @Version on slots are the primary concurrency controls.
-- This partial unique index is the final DB backstop: two ACTIVE bookings can
-- never reference the same slot, even if the lock were somehow bypassed.
--
-- CANCELLED bookings are excluded so a slot can be re-booked after a cancel.
-- The active statuses mirror the existing V1 partial indexes
-- (idx_bookings_status_due / idx_bookings_split_deadline).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_active_slot
    ON bookings (slot_id)
    WHERE status IN ('CONFIRMED', 'PAID', 'PARTIALLY_PAID');
