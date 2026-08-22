-- V43: Booking split payment and open game linkage
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS open_game_id BIGINT REFERENCES open_games(id);

ALTER TABLE booking_members
    ADD COLUMN IF NOT EXISTS share_token VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_members_share_token
    ON booking_members (share_token)
    WHERE share_token IS NOT NULL;
