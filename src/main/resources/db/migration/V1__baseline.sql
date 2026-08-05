-- ============================================================================
-- TurfChai — Flyway baseline (V1)
-- Complete PostgreSQL schema extracted from DATABASE_SCHEMA.md (v1.0).
--
-- Conventions used here (team-wide):
--   * Enum-like columns are VARCHAR + CHECK constraints (NOT native PG ENUMs).
--     Reason: the JPA entities use @Enumerated(EnumType.STRING) and the test
--     suite runs on H2 in PostgreSQL mode, which does not support native PG
--     enum types. Values are UPPERCASE to match the existing Java enums
--     (RoleType.PLAYER, OpenGameStatus.OPEN, ...).
--   * Every statement is idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING)
--     so teams that previously bootstrapped via spring.sql.init keep their
--     dev databases without dropping them.
--   * All timestamps are TIMESTAMPTZ (UTC); money is NUMERIC(12,2) in BDT.
-- ============================================================================

-- ============================================================================
-- 1. USERS (single table for every actor; platform role in users.role)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           VARCHAR(36) NOT NULL UNIQUE,
    full_name           VARCHAR(100) NOT NULL,
    email               VARCHAR(150) NOT NULL UNIQUE,
    phone               VARCHAR(20) NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    role                VARCHAR(30) NOT NULL DEFAULT 'PLAYER',
    status              VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    area                VARCHAR(100),
    avatar_url          TEXT,
    avatar_initials     VARCHAR(4),
    bio                 TEXT,

    -- Reliability & moderation
    reliability_score   SMALLINT NOT NULL DEFAULT 100
                        CHECK (reliability_score BETWEEN 0 AND 100),
    games_attended      INTEGER NOT NULL DEFAULT 0,
    games_no_show       INTEGER NOT NULL DEFAULT 0,
    is_suspended        BOOLEAN NOT NULL DEFAULT FALSE,
    suspension_reason   TEXT,
    suspended_until     TIMESTAMPTZ,

    -- Security (auth module)
    two_factor_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret   TEXT,
    email_verified_at   TIMESTAMPTZ,
    phone_verified_at   TIMESTAMPTZ,
    last_sign_in_at     TIMESTAMPTZ,
    last_sign_in_ip     INET,
    failed_login_count  SMALLINT NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,

    -- Onboarding & preferences
    onboarding_state    VARCHAR(30) NOT NULL DEFAULT 'VERIFY',
    play_style          VARCHAR(30),
    preferred_sports    VARCHAR(50)[],
    preferred_areas     VARCHAR(100)[],
    preferred_time_windows JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT ck_users_role CHECK (role IN ('PLAYER','SOLO_PLAYER','HOST','OWNER','ADMIN','SUPER_ADMIN')),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE','PENDING','SUSPENDED','DELETED')),
    CONSTRAINT ck_users_onboarding CHECK (onboarding_state IN ('VERIFY','ABOUT_YOU','PLAY_STYLE','COMPLETED'))
);

-- Columns added after the pre-Flyway (spring.sql.init) bootstrap, so existing
-- dev databases get them too:
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sign_in_ip INET;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_state VARCHAR(30) NOT NULL DEFAULT 'VERIFY';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_sports VARCHAR(50)[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_areas VARCHAR(100)[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_time_windows JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);
CREATE INDEX IF NOT EXISTS idx_users_area ON users (area);
CREATE INDEX IF NOT EXISTS idx_users_reliability ON users (reliability_score DESC)
    WHERE status = 'ACTIVE';

-- ============================================================================
-- 2. VENUES
-- ============================================================================
CREATE TABLE IF NOT EXISTS venues (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_code          VARCHAR(12) NOT NULL UNIQUE,
    name                VARCHAR(120) NOT NULL,
    owner_user_id       BIGINT NOT NULL REFERENCES users(id),
    status              VARCHAR(30) NOT NULL DEFAULT 'LIVE',

    -- Location
    address             VARCHAR(255) NOT NULL,
    area                VARCHAR(100) NOT NULL,
    lat                 NUMERIC(10,7),
    lng                 NUMERIC(10,7),

    -- Reputation
    rating_avg          NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (rating_avg BETWEEN 0 AND 5),
    review_count        INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    saved_count         INTEGER NOT NULL DEFAULT 0,

    -- Badges & discovery
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    is_tournament_ready BOOLEAN NOT NULL DEFAULT FALSE,
    has_promotion       BOOLEAN NOT NULL DEFAULT FALSE,
    promotion_label     VARCHAR(100),
    photos              JSONB NOT NULL DEFAULT '[]',
    amenities           JSONB NOT NULL DEFAULT '[]',

    -- Operations
    rules               TEXT,
    operating_hours     JSONB NOT NULL DEFAULT '{"open":"06:00","close":"23:00"}',
    default_buffer_min  SMALLINT NOT NULL DEFAULT 10,
    deposit_policy      VARCHAR(30) NOT NULL DEFAULT 'FULL_ONLY',
    cancel_policy       VARCHAR(30) NOT NULL DEFAULT 'FREE_24H_50_6H',
    allow_split_payment BOOLEAN NOT NULL DEFAULT TRUE,
    minimum_refund_hours SMALLINT NOT NULL DEFAULT 6,
    refund_window_full_hours SMALLINT NOT NULL DEFAULT 24,

    -- Contacts & payouts
    contact_phone       VARCHAR(20),
    contact_email       VARCHAR(150),
    bank_account        JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT ck_venues_status CHECK (status IN ('DRAFT','PENDING_LISTING','LIVE','SUSPENDED','REJECTED')),
    CONSTRAINT ck_venues_deposit CHECK (deposit_policy IN ('FULL_ONLY','THIRTY_PERCENT','FIFTY_PERCENT')),
    CONSTRAINT ck_venues_cancel CHECK (cancel_policy IN ('FREE_24H_50_6H','FLEXIBLE_6H','STRICT_NO_REFUND'))
);

ALTER TABLE venues ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS saved_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_tournament_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_promotion BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS promotion_label VARCHAR(100);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS amenities JSONB NOT NULL DEFAULT '[]';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rules TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS operating_hours JSONB NOT NULL DEFAULT '{"open":"06:00","close":"23:00"}';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS default_buffer_min SMALLINT NOT NULL DEFAULT 10;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS deposit_policy VARCHAR(30) NOT NULL DEFAULT 'FULL_ONLY';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS cancel_policy VARCHAR(30) NOT NULL DEFAULT 'FREE_24H_50_6H';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS allow_split_payment BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS minimum_refund_hours SMALLINT NOT NULL DEFAULT 6;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS refund_window_full_hours SMALLINT NOT NULL DEFAULT 24;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS bank_account JSONB;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_venues_area_status ON venues (area, status);
CREATE INDEX IF NOT EXISTS idx_venues_owner ON venues (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_venues_live_location ON venues (lat, lng) WHERE status = 'LIVE';
CREATE INDEX IF NOT EXISTS idx_venues_rating ON venues (rating_avg DESC) WHERE status = 'LIVE';

-- ============================================================================
-- 3. SPORTS (seed below)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sports (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    icon_url    TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE sports ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- ============================================================================
-- 4. PITCHES
-- ============================================================================
CREATE TABLE IF NOT EXISTS pitches (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id        BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name            VARCHAR(80) NOT NULL,
    surface_type    VARCHAR(100),
    surface_detail  VARCHAR(255),
    dimensions      VARCHAR(40),
    lighting        VARCHAR(120),
    format          VARCHAR(20),
    max_players     INTEGER NOT NULL DEFAULT 10 CHECK (max_players > 0),
    indoor          BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_pitches_venue_name UNIQUE (venue_id, name)
);

ALTER TABLE pitches ADD COLUMN IF NOT EXISTS surface_detail VARCHAR(255);
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS dimensions VARCHAR(40);
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS lighting VARCHAR(120);
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS indoor BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pitches_venue ON pitches (venue_id) WHERE is_active = TRUE;

-- ============================================================================
-- 5. PITCH_SPORTS (join table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pitch_sports (
    pitch_id    BIGINT NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    sport_id    BIGINT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    PRIMARY KEY (pitch_id, sport_id)
);

-- ============================================================================
-- 6. SPORT_PRICING_RULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS sport_pricing_rules (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id            BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    sport_id            BIGINT NOT NULL REFERENCES sports(id),
    slot_duration_min   INTEGER NOT NULL CHECK (slot_duration_min IN (30, 40, 60, 90, 120)),
    buffer_min          INTEGER NOT NULL DEFAULT 10 CHECK (buffer_min IN (5, 10, 15)),
    window_type         VARCHAR(12) NOT NULL CHECK (window_type IN ('OFF_PEAK','PEAK','FULL_DAY')),
    rate                NUMERIC(12,2) NOT NULL CHECK (rate >= 0),
    window_start        TIME NOT NULL,
    window_end          TIME NOT NULL,
    days_of_week        SMALLINT[] NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_pricing_venue_sport_window UNIQUE (venue_id, sport_id, window_type)
);

CREATE INDEX IF NOT EXISTS idx_pricing_venue_sport ON sport_pricing_rules (venue_id, sport_id)
    WHERE is_active = TRUE;

-- ============================================================================
-- 7. SLOTS (sellable time-slices; availability/locking lifecycle)
--    available -> held (5-min checkout lock) -> booked -> blocked
-- ============================================================================
CREATE TABLE IF NOT EXISTS slots (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id         BIGINT NOT NULL REFERENCES venues(id),
    pitch_id         BIGINT NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    slot_date        DATE NOT NULL,
    start_time       TIME NOT NULL,
    end_time         TIME NOT NULL,
    price            NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    status           VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    held_by_user_id  BIGINT REFERENCES users(id),
    hold_expires_at  TIMESTAMPTZ,
    source           VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_slots_status CHECK (status IN ('AVAILABLE','HELD','BOOKED','BLOCKED')),
    CONSTRAINT ck_slots_source CHECK (source IN ('ONLINE','WALK_IN','PHONE')),
    CONSTRAINT ck_slots_valid_window CHECK (end_time > start_time),
    CONSTRAINT ck_slots_hold_consistent CHECK (
        (status = 'HELD' AND held_by_user_id IS NOT NULL AND hold_expires_at IS NOT NULL)
        OR (status <> 'HELD' AND held_by_user_id IS NULL)
    ),
    CONSTRAINT uq_slots_pitch_window UNIQUE (pitch_id, slot_date, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_slots_availability
    ON slots (pitch_id, slot_date) WHERE status = 'AVAILABLE';
CREATE INDEX IF NOT EXISTS idx_slots_hold_cleanup
    ON slots (hold_expires_at) WHERE status = 'HELD';
CREATE INDEX IF NOT EXISTS idx_slots_venue_date ON slots (venue_id, slot_date);

-- ============================================================================
-- 8. PROMOTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS promotions (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id              BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    title                 VARCHAR(120) NOT NULL,
    kind                  VARCHAR(20) NOT NULL
                          CHECK (kind IN ('DISCOUNT_PERCENT','BUY_X_GET_Y','OFF_PEAK','FLAT')),
    value                 NUMERIC(12,2),
    conditions            JSONB NOT NULL DEFAULT '{}',
    auto_apply_at_checkout BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at             TIMESTAMPTZ NOT NULL,
    ends_at               TIMESTAMPTZ NOT NULL,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_promotions_window CHECK (ends_at > starts_at),
    CONSTRAINT ck_promotions_value CHECK (value IS NULL OR value > 0)
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions (venue_id, starts_at, ends_at)
    WHERE is_active = TRUE;

-- ============================================================================
-- 9. OPEN GAMES & LFG (solo play)
-- ============================================================================
CREATE TABLE IF NOT EXISTS open_games (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    game_code         VARCHAR(14) NOT NULL UNIQUE,
    title             VARCHAR(150) NOT NULL,
    venue_id          BIGINT NOT NULL REFERENCES venues(id),
    pitch_id          BIGINT REFERENCES pitches(id),
    game_date         DATE NOT NULL,
    start_time        TIME NOT NULL,
    end_time          TIME NOT NULL,
    skill_level       VARCHAR(30) NOT NULL DEFAULT 'ALL_LEVELS',
    capacity          INTEGER NOT NULL CHECK (capacity BETWEEN 2 AND 50),
    filled_count      INTEGER NOT NULL DEFAULT 0 CHECK (filled_count BETWEEN 0 AND capacity),
    price_per_player  NUMERIC(12,2) NOT NULL CHECK (price_per_player >= 0),
    organizer_user_id BIGINT NOT NULL REFERENCES users(id),
    status            VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    minimum_reliability INTEGER NOT NULL DEFAULT 90,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_open_games_window CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_open_games_live
    ON open_games (game_date, start_time) WHERE status IN ('OPEN','ALMOST_FULL');
CREATE INDEX IF NOT EXISTS idx_open_games_area_date ON open_games (game_date) WHERE status <> 'CANCELLED';

CREATE TABLE IF NOT EXISTS lfg_alerts (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    sport_id        BIGINT REFERENCES sports(id),
    area            VARCHAR(100) NOT NULL,
    preferred_days  VARCHAR(50),
    preferred_from  TIME,
    preferred_to    TIME,
    skill_level     VARCHAR(30),
    status          VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_matched_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_lfg_status CHECK (status IN ('ACTIVE','PAUSED','EXPIRED')),
    CONSTRAINT ck_lfg_window CHECK (preferred_to IS NULL OR preferred_from IS NULL
                                    OR preferred_to > preferred_from)
);

CREATE INDEX IF NOT EXISTS idx_lfg_active ON lfg_alerts (area, status) WHERE status = 'ACTIVE';

-- ============================================================================
-- 10. TOURNAMENTS (host hub)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tournaments (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tournament_code      VARCHAR(16) NOT NULL UNIQUE,
    name                 VARCHAR(150) NOT NULL,
    host_user_id         BIGINT NOT NULL REFERENCES users(id),
    venue_id             BIGINT NOT NULL REFERENCES venues(id),
    tournament_date      DATE NOT NULL,
    time_window_start    TIME NOT NULL,
    time_window_end      TIME NOT NULL,
    format               VARCHAR(20) NOT NULL,
    team_capacity        INTEGER NOT NULL CHECK (team_capacity > 0),
    registered_teams     INTEGER NOT NULL DEFAULT 0,
    entry_fee_per_team   NUMERIC(12,2) NOT NULL CHECK (entry_fee_per_team >= 0),
    prize_pool           NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    privacy              VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    invite_code          VARCHAR(32) NOT NULL UNIQUE,
    status               VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    pitches_reserved     INTEGER NOT NULL DEFAULT 0,
    slots_reserved       INTEGER NOT NULL DEFAULT 0,
    deposit_amount       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    balance_due_date     DATE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_tournaments_window CHECK (time_window_end > time_window_start),
    CONSTRAINT ck_tournaments_format CHECK (format IN ('5_A_SIDE','6_A_SIDE','7_A_SIDE','KNOCKOUT')),
    CONSTRAINT ck_tournaments_privacy CHECK (privacy IN ('OPEN','INVITE_ONLY')),
    CONSTRAINT ck_tournaments_status CHECK (status IN ('DRAFT','PUBLISHED','CONFIRMED','COMPLETED','CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_tournaments_venue_date ON tournaments (venue_id, tournament_date);
CREATE INDEX IF NOT EXISTS idx_tournaments_host ON tournaments (host_user_id);

CREATE TABLE IF NOT EXISTS tournament_teams (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tournament_id     BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name              VARCHAR(120) NOT NULL,
    captain_user_id   BIGINT NOT NULL REFERENCES users(id),
    join_status       VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    payment_status    VARCHAR(30) NOT NULL DEFAULT 'DUE',
    entry_fee_paid    BOOLEAN NOT NULL DEFAULT FALSE,
    balance_due_date  DATE,
    joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_team_tournament_name UNIQUE (tournament_id, name)
);

CREATE INDEX IF NOT EXISTS idx_team_tournament ON tournament_teams (tournament_id);

CREATE TABLE IF NOT EXISTS tournament_fixtures (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_label   VARCHAR(30) NOT NULL,
    pitch_id      BIGINT REFERENCES pitches(id),
    start_time    TIME NOT NULL,
    team_a_id     BIGINT REFERENCES tournament_teams(id),
    team_b_id     BIGINT REFERENCES tournament_teams(id),
    score_a       SMALLINT,
    score_b       SMALLINT,
    winner_team_id BIGINT REFERENCES tournament_teams(id),
    status        VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_fixtures_distinct_teams CHECK (team_a_id IS DISTINCT FROM team_b_id),
    CONSTRAINT uq_fixtures_tournament_slot UNIQUE (tournament_id, pitch_id, start_time)
);

CREATE INDEX IF NOT EXISTS idx_fixtures_tournament ON tournament_fixtures (tournament_id);

CREATE TABLE IF NOT EXISTS tournament_bookings (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    pitch_id      BIGINT NOT NULL REFERENCES pitches(id),
    slot_id       BIGINT NOT NULL REFERENCES slots(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_tournament_booking_slot UNIQUE (tournament_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_bookings_tournament ON tournament_bookings (tournament_id);

-- ============================================================================
-- 11. BOOKINGS (booking engine — player flow)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_code        VARCHAR(14) NOT NULL UNIQUE,
    booker_user_id      BIGINT NOT NULL REFERENCES users(id),
    venue_id            BIGINT NOT NULL REFERENCES venues(id),
    pitch_id            BIGINT NOT NULL REFERENCES pitches(id),
    slot_id             BIGINT NOT NULL REFERENCES slots(id),

    -- Schedule (snapshot at booking time)
    booking_date        DATE NOT NULL,
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,

    -- Money
    gross_amount        NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0),
    discount_amount     NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    promotion_id        BIGINT REFERENCES promotions(id),
    loyalty_points_used INTEGER NOT NULL DEFAULT 0,
    net_amount          NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0),
    amount_paid         NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),

    -- Flags & workflow
    status              VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    confirmation_type   VARCHAR(20) NOT NULL DEFAULT 'INSTANT',
    source              VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    cancel_policy_snapshot VARCHAR(30),
    refund_tier         VARCHAR(20),

    -- Split payment
    split_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    split_deadline      TIMESTAMPTZ,
    split_total_paid    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    split_remaining     NUMERIC(12,2) NOT NULL DEFAULT 0.00,

    -- Cancellation
    cancel_reason       VARCHAR(30),
    cancel_note         TEXT,
    cancelled_at        TIMESTAMPTZ,
    cancelled_by_user_id BIGINT REFERENCES users(id),

    -- Lifecycle
    confirmed_at        TIMESTAMPTZ,
    checked_in_at       TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_bookings_status CHECK (status IN ('PENDING','CONFIRMED','PAID','PARTIALLY_PAID',
                                                    'COMPLETED','NO_SHOW','CANCELLED','REFUNDED')),
    CONSTRAINT ck_bookings_confirm CHECK (confirmation_type IN ('INSTANT','MANUAL')),
    CONSTRAINT ck_bookings_source CHECK (source IN ('ONLINE','WALK_IN','PHONE')),
    CONSTRAINT ck_bookings_window CHECK (end_time > start_time),
    CONSTRAINT ck_bookings_money CHECK (amount_paid <= net_amount),
    CONSTRAINT ck_bookings_split CHECK (
        (split_enabled AND split_deadline IS NOT NULL AND split_remaining >= 0)
        OR (NOT split_enabled AND split_deadline IS NULL AND split_remaining = 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_bookings_booker ON bookings (booker_user_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_venue_date ON bookings (venue_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status_due
    ON bookings (booking_date, start_time) WHERE status IN ('CONFIRMED','PAID','PARTIALLY_PAID');
CREATE INDEX IF NOT EXISTS idx_bookings_split_deadline
    ON bookings (split_deadline) WHERE split_enabled = TRUE AND status IN ('CONFIRMED','PAID','PARTIALLY_PAID');

-- ============================================================================
-- 12. BOOKING_MEMBERS (split roster)
-- ============================================================================
CREATE TABLE IF NOT EXISTS booking_members (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id         BIGINT REFERENCES users(id),
    share_amount    NUMERIC(12,2) NOT NULL CHECK (share_amount >= 0),
    payment_status  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payment_method  VARCHAR(20),
    is_captain      BOOLEAN NOT NULL DEFAULT FALSE,
    invited_at      TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_member_pay_status CHECK (payment_status IN ('PAID','PENDING','INVITED','UNASSIGNED')),
    CONSTRAINT ck_booking_member_share CHECK (share_amount > 0),
    CONSTRAINT uq_booking_member UNIQUE (booking_id, user_id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS idx_booking_members_user ON booking_members (user_id);
CREATE INDEX IF NOT EXISTS idx_booking_members_status
    ON booking_members (booking_id, payment_status) WHERE payment_status <> 'PAID';

-- ============================================================================
-- 13. PAYMENTS (all money movements; reconciles unmatched bKash/Nagad txns)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    txn_reference       VARCHAR(30) NOT NULL UNIQUE,
    user_id             BIGINT NOT NULL REFERENCES users(id),
    booking_id          BIGINT REFERENCES bookings(id),
    booking_member_id   BIGINT REFERENCES booking_members(id),
    open_game_id        BIGINT REFERENCES open_games(id),
    tournament_id       BIGINT REFERENCES tournaments(id),
    type                VARCHAR(30) NOT NULL,
    amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency            CHAR(3) NOT NULL DEFAULT 'BDT',
    method              VARCHAR(20) NOT NULL,
    provider            VARCHAR(30),
    provider_txn_id     VARCHAR(80),
    status              VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
    failure_reason      VARCHAR(255),
    hold_until          TIMESTAMPTZ,
    is_reward_wallet_payment BOOLEAN NOT NULL DEFAULT FALSE,
    matched_to_booking_id BIGINT REFERENCES bookings(id),
    paid_at             TIMESTAMPTZ,
    refund_of_payment_id BIGINT REFERENCES payments(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_payments_type CHECK (type IN ('BOOKING','SPLIT_SHARE','OPEN_GAME',
                                                'TOURNAMENT_DEPOSIT','TOURNAMENT_BALANCE','REFUND','WALLET')),
    CONSTRAINT ck_payments_method CHECK (method IN ('BKASH','NAGAD','CARD','CASH')),
    CONSTRAINT ck_payments_status CHECK (status IN ('INITIATED','PENDING','SUCCESS','FAILED','REFUNDED','REVERSED')),
    CONSTRAINT ck_payments_context CHECK (
        (type IN ('BOOKING','SPLIT_SHARE') AND booking_id IS NOT NULL)
        OR (type = 'OPEN_GAME' AND open_game_id IS NOT NULL)
        OR (type IN ('TOURNAMENT_DEPOSIT','TOURNAMENT_BALANCE') AND tournament_id IS NOT NULL)
        OR (type = 'REFUND')
        OR (type = 'WALLET' AND booking_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_txn ON payments (provider_txn_id) WHERE provider_txn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_unmatched
    ON payments (created_at) WHERE status = 'SUCCESS' AND booking_id IS NULL AND type = 'BOOKING';
CREATE INDEX IF NOT EXISTS idx_payments_hold_until
    ON payments (hold_until) WHERE status = 'INITIATED';

-- ============================================================================
-- 13b. OPEN_GAME_MEMBERSHIPS (created after payments: payment_id FK)
-- ============================================================================
CREATE TABLE IF NOT EXISTS open_game_memberships (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    open_game_id  BIGINT NOT NULL REFERENCES open_games(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id),
    payment_id    BIGINT REFERENCES payments(id),
    status        VARCHAR(30) NOT NULL DEFAULT 'JOINED',
    show_up       BOOLEAN,
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_og_member_status CHECK (status IN ('REQUESTED','JOINED','PAID','CANCELLED')),
    CONSTRAINT uq_open_game_member UNIQUE (open_game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_og_members_user ON open_game_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_og_members_status
    ON open_game_memberships (open_game_id, status) WHERE status <> 'PAID';

-- ============================================================================
-- 14. REVIEWS (verified post-booking reviews)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES bookings(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    venue_id        BIGINT NOT NULL REFERENCES venues(id),
    overall_rating  SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    sub_ratings     JSONB NOT NULL DEFAULT '{}',
    comment         TEXT,
    tags            VARCHAR(30)[] NOT NULL DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    owner_reply     TEXT,
    owner_replied_at TIMESTAMPTZ,
    reported_count  INTEGER NOT NULL DEFAULT 0,
    reported_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_reviews_status CHECK (status IN ('PENDING','PUBLISHED','FLAGGED')),
    CONSTRAINT uq_reviews_booking UNIQUE (booking_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_venue_rating ON reviews (venue_id, status)
    WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews (user_id);

-- ============================================================================
-- 15. LOYALTY & REWARDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS loyalty_tiers (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(20) NOT NULL UNIQUE,
    min_points          INTEGER NOT NULL,
    discount_percent    NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    perks               JSONB NOT NULL DEFAULT '{}',
    sort_order          SMALLINT NOT NULL UNIQUE,

    CONSTRAINT ck_tiers_name CHECK (name IN ('SILVER','GOLD','PLATINUM'))
);

CREATE TABLE IF NOT EXISTS reward_products (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              VARCHAR(120) NOT NULL,
    kind              VARCHAR(30) NOT NULL,
    cost_points       INTEGER NOT NULL CHECK (cost_points > 0),
    value             NUMERIC(12,2),
    description       TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_reward_kind CHECK (kind IN ('WALLET_CREDIT','FREE_SLOT','DISCOUNT_NEXT','PRIORITY_PASS'))
);

CREATE TABLE IF NOT EXISTS point_ledger (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    delta           INTEGER NOT NULL,
    reason          VARCHAR(30) NOT NULL,
    reference_booking_id  BIGINT REFERENCES bookings(id),
    reference_open_game_id BIGINT REFERENCES open_games(id),
    reference_reward_id   BIGINT REFERENCES reward_products(id),
    balance_after   INTEGER NOT NULL,
    expires_at      TIMESTAMPTZ,
    note            VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_point_reason CHECK (reason IN ('BOOKING','ATTENDED_MATCH','REVIEW','PROFILE_COMPLETION',
                                                 'JOINED_OPEN_GAME','OFF_PEAK_BONUS','MONTHLY_BONUS',
                                                 'REDEMPTION','ADJUSTMENT','EXPIRY')),
    CONSTRAINT ck_point_ledger_delta CHECK (delta <> 0)
);

CREATE INDEX IF NOT EXISTS idx_point_ledger_user ON point_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_ledger_expiry
    ON point_ledger (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS reward_redemptions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    reward_id       BIGINT NOT NULL REFERENCES reward_products(id),
    cost_points     INTEGER NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    wallet_credit_amount NUMERIC(12,2),
    applied_to_booking_id BIGINT REFERENCES bookings(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,

    CONSTRAINT ck_redemption_status CHECK (status IN ('ISSUED','APPLIED','EXPIRED','VOIDED'))
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user ON reward_redemptions (user_id, status);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id),
    delta         NUMERIC(12,2) NOT NULL CHECK (delta <> 0),
    reason        VARCHAR(30) NOT NULL,
    redemption_id BIGINT REFERENCES reward_redemptions(id),
    booking_id    BIGINT REFERENCES bookings(id),
    balance_after NUMERIC(12,2) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_wallet_reason CHECK (reason IN ('REWARD_CREDIT','CHECKOUT_APPLY','ADJUSTMENT','CASHOUT'))
);

CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions (user_id, created_at DESC);

-- ============================================================================
-- 16. STAFF, SHIFTS & PAYOUTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_members (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id     BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    invited_by   BIGINT REFERENCES users(id),
    role         VARCHAR(20) NOT NULL DEFAULT 'FRONT_DESK',
    status       VARCHAR(20) NOT NULL DEFAULT 'INVITED',
    invite_token VARCHAR(64),
    invite_expires_at TIMESTAMPTZ,
    permissions  JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_staff_role CHECK (role IN ('OWNER','CO_OWNER','MANAGER','FRONT_DESK','ACCOUNTANT')),
    CONSTRAINT ck_staff_status CHECK (status IN ('INVITED','ACTIVE','DISABLED')),
    CONSTRAINT uq_staff_venue_user UNIQUE (venue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_venue ON staff_members (venue_id, status);

CREATE TABLE IF NOT EXISTS shift_records (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id             BIGINT NOT NULL REFERENCES venues(id),
    staff_user_id        BIGINT NOT NULL REFERENCES users(id),
    shift_name           VARCHAR(40) NOT NULL,
    start_time           TIMESTAMPTZ NOT NULL,
    end_time             TIMESTAMPTZ,
    opening_float        NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cash_logged          NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    expected_in_drawer   NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    counted_amount       NUMERIC(12,2),
    status               VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    closing_note         TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_shift_status CHECK (status IN ('OPEN','CLOSED','BALANCED','DISCREPANCY')),
    CONSTRAINT ck_shift_time CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_shifts_venue ON shift_records (venue_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_staff ON shift_records (staff_user_id, start_time DESC);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shift_id         BIGINT NOT NULL REFERENCES shift_records(id),
    booking_id       BIGINT REFERENCES bookings(id),
    amount           NUMERIC(12,2) NOT NULL CHECK (amount <> 0),
    direction        VARCHAR(10) NOT NULL CHECK (direction IN ('IN','OUT')),
    note             VARCHAR(255),
    logged_by_user_id BIGINT NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_shift ON cash_transactions (shift_id);

CREATE TABLE IF NOT EXISTS payouts (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id         BIGINT NOT NULL REFERENCES venues(id),
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    gross_amount     NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    online_revenue   NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    platform_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 6.00,
    platform_fee     NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    refund_amount    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    net_amount       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status           VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    scheduled_date   DATE NOT NULL,
    settled_at       TIMESTAMPTZ,
    bank_account     JSONB,
    anomaly_flag     VARCHAR(20) NOT NULL DEFAULT 'NONE',
    anomaly_note     TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_payouts_status CHECK (status IN ('SCHEDULED','IN_TRANSIT','SETTLED','FAILED')),
    CONSTRAINT ck_payouts_anomaly CHECK (anomaly_flag IN ('NONE','SUSPECTED','CONFIRMED')),
    CONSTRAINT ck_payouts_period CHECK (period_end >= period_start),
    CONSTRAINT uq_payouts_venue_period UNIQUE (venue_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_payouts_venue_date ON payouts (venue_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_payouts_anomaly ON payouts (anomaly_flag) WHERE anomaly_flag <> 'NONE';

-- ============================================================================
-- 17. ADMIN / AUDIT / COMMUNICATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS turf_requests (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_code           VARCHAR(12) NOT NULL UNIQUE,
    owner_user_id          BIGINT NOT NULL REFERENCES users(id),
    venue_id               BIGINT REFERENCES venues(id),
    name                   VARCHAR(120) NOT NULL,
    area                   VARCHAR(100) NOT NULL,
    address                VARCHAR(255),
    trade_license_number   VARCHAR(60),
    trade_license_expiry   DATE,
    nid_document_url       TEXT,
    photos                 JSONB NOT NULL DEFAULT '[]',
    status                 VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    reviewed_by_admin_id   BIGINT REFERENCES users(id),
    reviewed_at            TIMESTAMPTZ,
    review_note            TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_turf_request_status CHECK (status IN ('PENDING','APPROVED','REJECTED','CHANGES_REQUESTED'))
);

CREATE INDEX IF NOT EXISTS idx_turf_requests_status ON turf_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_turf_requests_owner ON turf_requests (owner_user_id);

CREATE TABLE IF NOT EXISTS activity_logs (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_type     VARCHAR(20) NOT NULL,
    actor_user_id  BIGINT REFERENCES users(id),
    action         VARCHAR(30) NOT NULL,
    target_type    VARCHAR(30) NOT NULL,
    target_id      VARCHAR(32) NOT NULL,
    details        JSONB NOT NULL DEFAULT '{}',
    ip_address     INET,
    user_agent     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_target ON activity_logs (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs (action, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(40) NOT NULL,
    title       VARCHAR(150) NOT NULL,
    body        TEXT,
    ref_type    VARCHAR(30),
    ref_id      BIGINT,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_notif_ref CHECK (
        (ref_type IS NULL AND ref_id IS NULL)
        OR (ref_type IS NOT NULL AND ref_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_venues (
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_venues_venue ON saved_venues (venue_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id     BIGINT NOT NULL REFERENCES users(id),
    recipient_id  BIGINT NOT NULL REFERENCES users(id),
    booking_id    BIGINT REFERENCES bookings(id),
    tournament_id BIGINT REFERENCES tournaments(id),
    body          TEXT NOT NULL CHECK (length(body) > 0),
    is_flagged    BOOLEAN NOT NULL DEFAULT FALSE,
    read_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_recipient
    ON chat_messages (recipient_id, is_flagged, created_at DESC) WHERE is_flagged = FALSE;

-- ============================================================================
-- 18. SEED DATA (idempotent)
-- ============================================================================
INSERT INTO sports (name, slug, icon_url) VALUES
    ('Football',  'football',  NULL),
    ('Cricket',   'cricket',   NULL),
    ('Futsal',    'futsal',    NULL),
    ('Badminton', 'badminton', NULL),
    ('Basketball','basketball',NULL),
    ('Volleyball','volleyball',NULL)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO loyalty_tiers (name, min_points, discount_percent, perks, sort_order) VALUES
    ('SILVER',    0,    0.00, '{"priority_booking":false,"free_extension_min":0}',  1),
    ('GOLD',   1000,   10.00, '{"priority_booking":false,"free_extension_min":30}', 2),
    ('PLATINUM',2000,  15.00, '{"priority_booking":true, "free_extension_min":30}', 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO reward_products (name, kind, cost_points, value, description)
SELECT '৳50 off',              'WALLET_CREDIT',   500,  50.00,  'BDT 50 wallet credit'
WHERE NOT EXISTS (SELECT 1 FROM reward_products WHERE name = '৳50 off');
INSERT INTO reward_products (name, kind, cost_points, value, description)
SELECT '৳150 off',             'WALLET_CREDIT',  1000, 150.00,  'BDT 150 wallet credit'
WHERE NOT EXISTS (SELECT 1 FROM reward_products WHERE name = '৳150 off');
INSERT INTO reward_products (name, kind, cost_points, value, description)
SELECT 'Free 1-hr slot',       'FREE_SLOT',      2000,   1.00,  'Free 1-hour slot'
WHERE NOT EXISTS (SELECT 1 FROM reward_products WHERE name = 'Free 1-hr slot');
INSERT INTO reward_products (name, kind, cost_points, value, description)
SELECT '10% off next booking', 'DISCOUNT_NEXT',  2500,  10.00,  '10% off next booking'
WHERE NOT EXISTS (SELECT 1 FROM reward_products WHERE name = '10% off next booking');
INSERT INTO reward_products (name, kind, cost_points, value, description)
SELECT 'Priority Booking Pass','PRIORITY_PASS',  3000,  NULL,   'Priority booking pass'
WHERE NOT EXISTS (SELECT 1 FROM reward_products WHERE name = 'Priority Booking Pass');

-- ============================================================================
-- 19. FUNCTIONS & TRIGGERS
-- ============================================================================

-- 19.1 updated_at maintenance (applied to every mutable table)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

-- 19.2 Atomic slot hold (returns FALSE when the slot is no longer available).
--      Core to the booking engine — prevents double-hold/double-book.
CREATE OR REPLACE FUNCTION hold_slot(p_slot_id BIGINT, p_user_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
    v_held BOOLEAN;
BEGIN
    UPDATE slots
       SET status = 'HELD',
           held_by_user_id = p_user_id,
           hold_expires_at = now() + interval '5 minutes'
     WHERE id = p_slot_id AND status = 'AVAILABLE'
     RETURNING TRUE INTO v_held;

    RETURN COALESCE(v_held, FALSE);
END $$;

-- 19.3 On booking confirmation, flip the linked slot to BOOKED.
CREATE OR REPLACE FUNCTION confirm_booking()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE slots
       SET status = 'BOOKED', held_by_user_id = NULL, hold_expires_at = NULL
     WHERE id = NEW.slot_id AND status = 'HELD';
    RETURN NEW;
END $$;

-- Trigger creation is idempotent: only create when missing.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_venues_updated_at') THEN
        CREATE TRIGGER trg_venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pitches_updated_at') THEN
        CREATE TRIGGER trg_pitches_updated_at BEFORE UPDATE ON pitches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_slots_updated_at') THEN
        CREATE TRIGGER trg_slots_updated_at BEFORE UPDATE ON slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bookings_updated_at') THEN
        CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_booking_confirmed') THEN
        CREATE TRIGGER trg_booking_confirmed
            AFTER INSERT OR UPDATE OF status ON bookings
            FOR EACH ROW
            WHEN (NEW.status IN ('PAID', 'CONFIRMED'))
            EXECUTE FUNCTION confirm_booking();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payments_updated_at') THEN
        CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reviews_updated_at') THEN
        CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_open_games_updated_at') THEN
        CREATE TRIGGER trg_open_games_updated_at BEFORE UPDATE ON open_games FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_og_members_updated_at') THEN
        CREATE TRIGGER trg_og_members_updated_at BEFORE UPDATE ON open_game_memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lfg_updated_at') THEN
        CREATE TRIGGER trg_lfg_updated_at BEFORE UPDATE ON lfg_alerts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;
