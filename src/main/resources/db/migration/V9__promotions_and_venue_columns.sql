-- ============================================================================
-- V9: Promotions table & venue slug / photos_csv back-fill
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
CREATE TABLE IF NOT EXISTS promotions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id        BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    code            VARCHAR(30) NOT NULL,
    label           VARCHAR(120) NOT NULL,

    -- Discount type: 'PERCENT' or 'FLAT'
    discount_type   VARCHAR(10) NOT NULL DEFAULT 'PERCENT'
                    CHECK (discount_type IN ('PERCENT', 'FLAT')),

    -- Percent off (0-100) when discount_type='PERCENT'; amount off when 'FLAT'
    discount_value  NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),

    -- Optional minimum booking amount in BDT before promo applies
    min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,

    -- Optional maximum discount cap in BDT (null = no cap)
    max_discount_amount NUMERIC(12,2),

    -- JSONB conditions e.g. {"sports":["football"],"days_of_week":[6,7]}
    conditions      JSONB NOT NULL DEFAULT '{}',

    -- Validity window
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until     TIMESTAMPTZ,

    -- Usage limits
    usage_limit     INTEGER,
    usage_count     INTEGER NOT NULL DEFAULT 0,

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_promotions_venue_code UNIQUE (venue_id, code),
    CONSTRAINT ck_promotions_percent_range CHECK (
        discount_type <> 'PERCENT' OR discount_value BETWEEN 0 AND 100
    )
);

CREATE INDEX IF NOT EXISTS idx_promotions_venue ON promotions (venue_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions (code) WHERE is_active = TRUE;
