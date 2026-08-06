-- ============================================================================
-- V10: Promotions table & venue slug / photos_csv back-fill
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

-- 2. promotions table
-- V1 baseline already created `promotions` (title/kind/value/...), so reconcile
-- that table with the entity/V10 shape (code/label/discount_type/...) instead of
-- CREATE TABLE IF NOT EXISTS (which is a no-op and would leave legacy columns).
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS code VARCHAR(30) NOT NULL DEFAULT '';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS label VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) NOT NULL DEFAULT 'PERCENT';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(12,2);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE promotions DROP CONSTRAINT IF EXISTS ck_promotions_window;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS ck_promotions_value;
ALTER TABLE promotions DROP COLUMN IF EXISTS title;
ALTER TABLE promotions DROP COLUMN IF EXISTS kind;
ALTER TABLE promotions DROP COLUMN IF EXISTS value;
ALTER TABLE promotions DROP COLUMN IF EXISTS auto_apply_at_checkout;
ALTER TABLE promotions DROP COLUMN IF EXISTS starts_at;
ALTER TABLE promotions DROP COLUMN IF EXISTS ends_at;

ALTER TABLE promotions ADD CONSTRAINT uq_promotions_venue_code UNIQUE (venue_id, code);
ALTER TABLE promotions ADD CONSTRAINT ck_promotions_discount_type CHECK (discount_type IN ('PERCENT', 'FLAT'));
ALTER TABLE promotions ADD CONSTRAINT ck_promotions_percent_range CHECK (
    discount_type <> 'PERCENT' OR discount_value BETWEEN 0 AND 100
);

CREATE INDEX IF NOT EXISTS idx_promotions_venue ON promotions (venue_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions (code) WHERE is_active = TRUE;
