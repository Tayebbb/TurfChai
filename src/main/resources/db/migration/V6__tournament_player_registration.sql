-- ============================================================================
-- V6: Player-facing tournament registration (additive)
-- ============================================================================

ALTER TABLE tournament_teams
    ADD COLUMN IF NOT EXISTS registration_code       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS registered_by_user_id   BIGINT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS contact_phone           VARCHAR(20),
    ADD COLUMN IF NOT EXISTS emergency_contact       VARCHAR(120),
    ADD COLUMN IF NOT EXISTS jersey_number           VARCHAR(8),
    ADD COLUMN IF NOT EXISTS skill_level             VARCHAR(20),
    ADD COLUMN IF NOT EXISTS medical_notes           VARCHAR(500);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_team_registration_code') THEN
        ALTER TABLE tournament_teams
            ADD CONSTRAINT uq_team_registration_code UNIQUE (registration_code);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teams_registered_by
    ON tournament_teams (registered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_browse
    ON tournaments (status, privacy, tournament_date);
