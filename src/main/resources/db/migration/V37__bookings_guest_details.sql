-- V37: Add guest details and notes for manual bookings
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS guest_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(30),
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill existing manual bookings that have MB- prefix
UPDATE bookings
SET source = CASE WHEN MOD(id, 2) = 0 THEN 'PHONE' ELSE 'WALK_IN' END
WHERE booking_code LIKE 'MB-%' AND (source IS NULL OR source = 'ONLINE');
