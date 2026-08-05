-- ============================================================================
-- V3: Player-platform alignment (venue discovery, profiles, tournament hub)
-- Additive changes only — maps the merged JPA entities onto the V1 baseline.
-- ============================================================================

-- Venue discovery -------------------------------------------------------------
ALTER TABLE venues ADD COLUMN IF NOT EXISTS slug VARCHAR(80);
UPDATE venues SET slug = 'venue-' || id WHERE slug IS NULL;
ALTER TABLE venues ALTER COLUMN slug SET NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_venues_slug') THEN
        ALTER TABLE venues ADD CONSTRAINT uq_venues_slug UNIQUE (slug);
    END IF;
END $$;

-- CSV amenities used by the discovery filters (interim beside the JSONB column)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS amenities_csv VARCHAR(500);

-- Flat operating-hours columns used by the open-at filter
ALTER TABLE venues ADD COLUMN IF NOT EXISTS open_time  TIME NOT NULL DEFAULT '06:00',
                   ADD COLUMN IF NOT EXISTS close_time TIME NOT NULL DEFAULT '23:00';

-- Player profiles -------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_role VARCHAR(30),
                  ADD COLUMN IF NOT EXISTS preferred_sports_csv TEXT,
                  ADD COLUMN IF NOT EXISTS preferred_times_csv TEXT;

-- saved_venues bookmark timestamp is named created_at in the entity mapping (already matches baseline)

-- Tournament hub --------------------------------------------------------------
-- Interim captain contact until team captains are linked to accounts
ALTER TABLE tournament_teams ADD COLUMN IF NOT EXISTS captain_name VARCHAR(100),
                             ADD COLUMN IF NOT EXISTS entry_fee_paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tournament_teams ALTER COLUMN captain_user_id DROP NOT NULL;

-- Bracket ordering + byes (a bye has no pitch/kick-off time)
ALTER TABLE tournament_fixtures ADD COLUMN IF NOT EXISTS match_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tournament_fixtures ALTER COLUMN start_time DROP NOT NULL;

-- Multi-pitch reservations: pitch/time slots blocked for a tournament day.
-- The unique constraint rejects exact duplicates; partial overlaps are
-- prevented by the service layer under a pessimistic pitch-row lock.
CREATE TABLE IF NOT EXISTS tournament_pitch_reservations (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    pitch_id      BIGINT NOT NULL REFERENCES pitches(id),
    slot_date     DATE NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    price         NUMERIC(12,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT uq_reservation_pitch_slot UNIQUE (pitch_id, slot_date, start_time),
    CONSTRAINT ck_reservation_window CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_reservations_pitch_date
    ON tournament_pitch_reservations (pitch_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_reservations_tournament
    ON tournament_pitch_reservations (tournament_id);
