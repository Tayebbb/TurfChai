-- ============================================================================
-- V16: Alter venues buffer and refund window column types to INTEGER
-- Matches JPA Entity type (int / Integer) in com.turfchai.venue.entity.Venue
-- ============================================================================

ALTER TABLE venues ALTER COLUMN default_buffer_min TYPE INTEGER;
ALTER TABLE venues ALTER COLUMN minimum_refund_hours TYPE INTEGER;
ALTER TABLE venues ALTER COLUMN refund_window_full_hours TYPE INTEGER;
