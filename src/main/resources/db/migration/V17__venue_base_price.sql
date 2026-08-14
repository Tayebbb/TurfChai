-- ============================================================================
-- V13: Add base_price to venues for ML dynamic pricing anchor
-- ============================================================================
ALTER TABLE venues ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2) NOT NULL DEFAULT 1000.00;
COMMENT ON COLUMN venues.base_price IS 'Owner-defined base price (BDT). The ML multiplier is applied on top of this.';
