-- ============================================================================
-- V25: Drop legacy promotion columns
-- 
-- The V10 migration added the new Promotion columns, but it left the legacy
-- columns (title, kind, starts_at, ends_at) which were defined as NOT NULL.
-- As a result, inserting new promotions threw DataIntegrityViolationException.
-- This migration cleans up the old columns and constraints.
-- ============================================================================

-- 1. Drop old constraints
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS ck_promotions_window;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS ck_promotions_value;

-- 2. Drop old index
DROP INDEX IF EXISTS idx_promotions_active;

-- 3. Drop old columns
ALTER TABLE promotions DROP COLUMN IF EXISTS title;
ALTER TABLE promotions DROP COLUMN IF EXISTS kind;
ALTER TABLE promotions DROP COLUMN IF EXISTS value;
ALTER TABLE promotions DROP COLUMN IF EXISTS starts_at;
ALTER TABLE promotions DROP COLUMN IF EXISTS ends_at;
ALTER TABLE promotions DROP COLUMN IF EXISTS auto_apply_at_checkout;
