-- ============================================================================
-- TurfChai — Database Schema Script for Solo Open Games & LFG
-- PostgreSQL / H2 Compatible DDL Script
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           VARCHAR(36) NOT NULL UNIQUE,
    full_name           VARCHAR(100) NOT NULL,
    email               VARCHAR(150) NOT NULL UNIQUE,
    phone               VARCHAR(20) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    role                VARCHAR(30) NOT NULL DEFAULT 'PLAYER',
    status              VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    area                VARCHAR(100),
    avatar_url          VARCHAR(255),
    avatar_initials     VARCHAR(4),
    bio                 TEXT,
    reliability_score   INT NOT NULL DEFAULT 100 CHECK (reliability_score BETWEEN 0 AND 100),
    games_attended      INT NOT NULL DEFAULT 0,
    games_no_show       INT NOT NULL DEFAULT 0,
    is_suspended        BOOLEAN NOT NULL DEFAULT FALSE,
    play_style          VARCHAR(30),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS venues (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_code          VARCHAR(12) NOT NULL UNIQUE,
    name                VARCHAR(120) NOT NULL,
    owner_user_id       BIGINT NOT NULL REFERENCES users(id),
    status              VARCHAR(30) NOT NULL DEFAULT 'LIVE',
    address             VARCHAR(255) NOT NULL,
    area                VARCHAR(100) NOT NULL,
    rating_avg          NUMERIC(3,2) NOT NULL DEFAULT 4.80,
    review_count        INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sports (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(50) NOT NULL UNIQUE,
    slug                VARCHAR(50) NOT NULL UNIQUE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS pitches (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venue_id            BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name                VARCHAR(80) NOT NULL,
    surface_type        VARCHAR(100),
    format              VARCHAR(20),
    max_players         INT NOT NULL DEFAULT 10,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS open_games (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    game_code           VARCHAR(14) NOT NULL UNIQUE,
    title               VARCHAR(150) NOT NULL,
    venue_id            BIGINT NOT NULL REFERENCES venues(id),
    pitch_id            BIGINT REFERENCES pitches(id),
    game_date           DATE NOT NULL,
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,
    skill_level         VARCHAR(30) NOT NULL DEFAULT 'ALL_LEVELS',
    capacity            INT NOT NULL CHECK (capacity BETWEEN 2 AND 50),
    filled_count        INT NOT NULL DEFAULT 0 CHECK (filled_count BETWEEN 0 AND capacity),
    price_per_player    NUMERIC(12,2) NOT NULL CHECK (price_per_player >= 0),
    organizer_user_id   BIGINT NOT NULL REFERENCES users(id),
    status              VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    minimum_reliability INT NOT NULL DEFAULT 90,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_open_games_window CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS open_game_memberships (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    open_game_id        BIGINT NOT NULL REFERENCES open_games(id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL REFERENCES users(id),
    payment_id          BIGINT,
    status              VARCHAR(30) NOT NULL DEFAULT 'JOINED',
    show_up             BOOLEAN,
    joined_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_open_game_member UNIQUE (open_game_id, user_id)
);

CREATE TABLE IF NOT EXISTS lfg_alerts (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id),
    sport_id            BIGINT REFERENCES sports(id),
    area                VARCHAR(100) NOT NULL,
    preferred_days      VARCHAR(50),
    preferred_from      TIME,
    preferred_to        TIME,
    skill_level         VARCHAR(30),
    status              VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_matched_at     TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_open_games_live ON open_games (game_date, start_time);
CREATE INDEX IF NOT EXISTS idx_og_members_user ON open_game_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_lfg_active ON lfg_alerts (area, status);
