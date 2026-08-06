-- ============================================================================
-- V10: Promotions table & venue slug / photos_csv back-fill
--
-- NOTE: rewritten to be fully idempotent. V1__baseline.sql already creates a
-- legacy `promotions` table (title/kind/value/starts_at/ends_at), so the
-- original CREATE TABLE IF NOT EXISTS was a silent no-op and the index on
-- `code` crashed every fresh-database boot with:
--   ERROR: column "code" does not exist
-- Every statement below is safe to re-run on a DB that already applied the
-- old V10 content (columns/constraints/indexes exist) or on a legacy table.
-- ============================================================================

-- 1. Add slug column to venues if missing (the JPA entity now requires it)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS slug VARCHAR(80) UNIQUE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS open_time TIME NOT NULL DEFAULT '06:00';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS close_time TIME NOT NULL DEFAULT '23:00';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS default_buffer_min SMALLINT NOT NULL DEFAULT 10;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS photos_csv TEXT DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS amenities_csv VARCHAR(500) DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150);

-- 2. Align the legacy promotions table with the Promotion entity (new schema)
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS code VARCHAR(30);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS label VARCHAR(120);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) NOT NULL DEFAULT 'PERCENT'
    CHECK (discount_type IN ('PERCENT', 'FLAT'));
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(12,2);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;

-- Back-fill legacy rows before imposing NOT NULL (null-safe; no-op when empty)
UPDATE promotions SET code = 'PROMO-' || id WHERE code IS NULL;
UPDATE promotions SET label = title WHERE label IS NULL;

ALTER TABLE promotions ALTER COLUMN code SET NOT NULL;
ALTER TABLE promotions ALTER COLUMN label SET NOT NULL;

ALTER TABLE promotions ADD CONSTRAINT IF NOT EXISTS uq_promotions_venue_code UNIQUE (venue_id, code);
ALTER TABLE promotions ADD CONSTRAINT IF NOT EXISTS ck_promotions_percent_range CHECK (
    discount_type <> 'PERCENT' OR discount_value BETWEEN 0 AND 100
);

CREATE INDEX IF NOT EXISTS idx_promotions_venue ON promotions (venue_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions (code) WHERE is_active = TRUE;
