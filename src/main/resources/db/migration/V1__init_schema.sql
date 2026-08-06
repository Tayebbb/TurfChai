-- =============================================================================
-- V1__init_schema.sql
-- TurfChai — Initial schema for H2 (PostgreSQL-mode) development database
--
-- NOTE: This is an H2-compatible version of the full PostgreSQL schema
-- documented in DATABASE_SCHEMA.md.
--
-- Key adaptations for H2:
--   • PostgreSQL ENUM types  → VARCHAR + CHECK constraints
--   • JSONB columns          → TEXT (JSON stored as string)
--   • TEXT[]  arrays         → ARRAY (H2 supports basic ARRAY type)
--   • GENERATED ALWAYS AS IDENTITY → BIGINT AUTO_INCREMENT
--   • CITEXT               → VARCHAR (case-insensitivity handled in app layer)
--   • NUMERIC(n,m)         → NUMERIC(n,m)  [compatible]
--   • TIMESTAMPTZ          → TIMESTAMP WITH TIME ZONE  [compatible]
--   • BIGINT REFERENCES    → BIGINT (FK constraints declared inline)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT RANDOM_UUID() UNIQUE,
    full_name           VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    email               VARCHAR(255) NOT NULL UNIQUE,
    phone               VARCHAR(20) NOT NULL UNIQUE DEFAULT '0',
    password_hash       TEXT NOT NULL DEFAULT '',
    role                VARCHAR(20) NOT NULL DEFAULT 'player'
                        CHECK (role IN ('player', 'solo_player', 'host', 'owner', 'admin', 'super_admin')),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
    area                VARCHAR(100),
    avatar_url          TEXT,
    avatar_initials     VARCHAR(4),
    bio                 TEXT,
    reliability_score   SMALLINT NOT NULL DEFAULT 100
                        CHECK (reliability_score BETWEEN 0 AND 100),
    games_attended      INTEGER NOT NULL DEFAULT 0,
    games_no_show       INTEGER NOT NULL DEFAULT 0,
    is_suspended        BOOLEAN NOT NULL DEFAULT FALSE,
    suspension_reason   TEXT,
    suspended_until     TIMESTAMP WITH TIME ZONE,
    onboarding_state    VARCHAR(20) NOT NULL DEFAULT 'verify'
                        CHECK (onboarding_state IN ('verify', 'profile', 'preferences', 'done')),
    points_balance      INTEGER NOT NULL DEFAULT 0,
    tier                VARCHAR(20) NOT NULL DEFAULT 'silver'
                        CHECK (tier IN ('silver', 'gold', 'platinum')),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP WITH TIME ZONE
);

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venues (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_code          VARCHAR(12) NOT NULL UNIQUE,
    name                VARCHAR(120) NOT NULL DEFAULT 'Unnamed Venue',
    owner_user_id       BIGINT NOT NULL REFERENCES users(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_review', 'live', 'suspended', 'closed')),
    address             VARCHAR(255) NOT NULL DEFAULT '',
    area                VARCHAR(100) NOT NULL DEFAULT '',
    lat                 NUMERIC(10,7),
    lng                 NUMERIC(10,7),
    rating_avg          NUMERIC(3,2) NOT NULL DEFAULT 0.00
                        CHECK (rating_avg BETWEEN 0 AND 5),
    review_count        INTEGER NOT NULL DEFAULT 0
                        CHECK (review_count >= 0),
    saved_count         INTEGER NOT NULL DEFAULT 0,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    is_tournament_ready BOOLEAN NOT NULL DEFAULT FALSE,
    has_promotion       BOOLEAN NOT NULL DEFAULT FALSE,
    promotion_label     VARCHAR(100),
    photos              TEXT NOT NULL DEFAULT '[]',
    amenities           TEXT NOT NULL DEFAULT '[]',
    rules               TEXT,
    operating_hours     TEXT NOT NULL DEFAULT '{"open":"06:00","close":"23:00"}',
    deposit_policy      VARCHAR(20) NOT NULL DEFAULT 'full_only'
                        CHECK (deposit_policy IN ('full_only', 'deposit_50', 'deposit_30', 'free_cancel')),
    cancel_policy       VARCHAR(30) NOT NULL DEFAULT 'free_24h_50_6h'
                        CHECK (cancel_policy IN ('free_24h_50_6h', 'strict', 'flexible')),
    allow_split_payment BOOLEAN NOT NULL DEFAULT TRUE,
    minimum_refund_hours SMALLINT NOT NULL DEFAULT 6,
    refund_window_full_hours SMALLINT NOT NULL DEFAULT 24,
    contact_phone       VARCHAR(20),
    contact_email       VARCHAR(255),
    bank_account        TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMP WITH TIME ZONE
);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_code        VARCHAR(14) NOT NULL UNIQUE,
    booker_user_id      BIGINT NOT NULL REFERENCES users(id),
    venue_id            BIGINT NOT NULL REFERENCES venues(id),
    booking_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time          TIME NOT NULL DEFAULT '00:00:00',
    end_time            TIME NOT NULL DEFAULT '01:00:00',
    gross_amount        NUMERIC(12,2) NOT NULL DEFAULT 0.00
                        CHECK (gross_amount >= 0),
    discount_amount     NUMERIC(12,2) NOT NULL DEFAULT 0.00
                        CHECK (discount_amount >= 0),
    net_amount          NUMERIC(12,2) NOT NULL DEFAULT 0.00
                        CHECK (net_amount >= 0),
    amount_paid         NUMERIC(12,2) NOT NULL DEFAULT 0.00
                        CHECK (amount_paid >= 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'paid', 'partially_paid',
                                          'completed', 'no_show', 'cancelled', 'refunded')),
    source              VARCHAR(10) NOT NULL DEFAULT 'online'
                        CHECK (source IN ('online', 'walk_in', 'phone')),
    split_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    split_deadline      TIMESTAMP WITH TIME ZONE,
    split_total_paid    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    split_remaining     NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cancel_reason       VARCHAR(30),
    cancel_note         TEXT,
    cancelled_at        TIMESTAMP WITH TIME ZONE,
    cancelled_by_user_id BIGINT REFERENCES users(id),
    confirmed_at        TIMESTAMP WITH TIME ZONE,
    checked_in_at       TIMESTAMP WITH TIME ZONE,
    completed_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_bookings_window CHECK (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES bookings(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    venue_id        BIGINT NOT NULL REFERENCES venues(id),
    overall_rating  SMALLINT NOT NULL
                    CHECK (overall_rating BETWEEN 1 AND 5),
    sub_ratings     TEXT NOT NULL DEFAULT '{}',
    comment         TEXT,
    tags            ARRAY,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'published', 'flagged')),
    owner_reply     TEXT,
    owner_replied_at TIMESTAMP WITH TIME ZONE,
    reported_count  INTEGER NOT NULL DEFAULT 0,
    reported_reason TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_reviews_booking UNIQUE (booking_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Seed data for dev/demo — a single user, venue, and booking so that
-- the ReviewPage and MatchdayPage can call the API without 404s.
-- ---------------------------------------------------------------------------
INSERT INTO users (id, full_name, email, phone, password_hash, role, status)
VALUES (1, 'Rafi Kamal', 'rafi@turfchai.com', '01711000001', 'bcrypt-placeholder', 'player', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO venues (id, venue_code, name, owner_user_id, status, address, area)
VALUES (1, 'V-0001', 'Kick Off Arena', 1, 'live', 'House 12, Road 27, Dhanmondi', 'Dhanmondi')
ON CONFLICT DO NOTHING;

INSERT INTO bookings (id, booking_code, booker_user_id, venue_id,
                      booking_date, start_time, end_time,
                      gross_amount, net_amount, status)
VALUES (1, 'TC-48291', 1, 1,
        CURRENT_DATE + INTERVAL '2' DAY, '19:30:00', '21:00:00',
        2800.00, 2800.00, 'confirmed')
ON CONFLICT DO NOTHING;
