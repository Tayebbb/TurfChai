-- ============================================================================
-- V17: Add is_ml_pricing_enabled to venues
-- ============================================================================
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_ml_pricing_enabled BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN venues.is_ml_pricing_enabled IS 'Owner toggle for ML dynamic pricing model';
