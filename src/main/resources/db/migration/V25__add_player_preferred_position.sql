-- ============================================================================
-- V25: Player preferred position
-- Additive column for the player onboarding "Preferred Position" field.
-- `IF NOT EXISTS` keeps this safe on databases where the column was applied
-- manually during development.
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_position VARCHAR(50);
