-- ============================================================================
-- V10: Promotions table & venue slug / photos_csv back-fill
-- ============================================================================

-- 1. Add venue columns if missing (JPA entity compatibility)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS slug VARCHAR(80);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS open_time TIME NOT NULL DEFAULT '06:00';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS close_time TIME NOT NULL DEFAULT '23:00';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS default_buffer_min INTEGER NOT NULL DEFAULT 10;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS photos_csv TEXT DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS amenities_csv VARCHAR(500) DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150);

-- 2. Promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id            BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    code                VARCHAR(30),
    label               VARCHAR(120),

    discount_type       VARCHAR(10) NOT NULL DEFAULT 'PERCENT'
                        CHECK (discount_type IN ('PERCENT', 'FLAT')),

    discount_value      NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),

    min_order_amount    NUMERIC(12,2) NOT NULL DEFAULT 0.00,

    max_discount_amount NUMERIC(12,2),

    conditions          JSONB NOT NULL DEFAULT '{}',

    valid_from          TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until         TIMESTAMPTZ,

    usage_limit         INTEGER,
    usage_count         INTEGER NOT NULL DEFAULT 0,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all columns exist even if promotions table was created in an earlier baseline schema
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS code VARCHAR(30);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS label VARCHAR(120);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) NOT NULL DEFAULT 'PERCENT';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(12,2);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_promotions_venue ON promotions (venue_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions (code) WHERE is_active = TRUE;
