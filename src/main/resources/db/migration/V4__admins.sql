-- ============================================================================
-- V3: Admins (access control for the Owner & Admin Console)
--
--   * `admins` holds admin-specific metadata. Identity/auth stays in `users`
--     (users.role = ADMIN | SUPER_ADMIN is the source of truth).
--   * The platform has exactly ONE super admin — enforced by a partial unique
--     index on users.role. Additional admins are appointed by the super admin
--     (admins.appointed_by) and can be many.
--   * Seed: promotes Nadia (V2 demo admin) to SUPER_ADMIN and creates two more
--     ACTIVE demo admins (Farid = verification, Tania = support), all with the
--     password "TurfChai@123" so the console is usable right after startup.
-- ============================================================================

CREATE TABLE IF NOT EXISTS admins (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    admin_role        VARCHAR(30) NOT NULL
                      CHECK (admin_role IN ('SUPER','VERIFICATION','SUPPORT','FINANCE')),
    permissions       JSONB NOT NULL DEFAULT '{}',
    appointed_by      BIGINT REFERENCES users(id),
    appointed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status            VARCHAR(20) NOT NULL DEFAULT 'INVITED'
                      CHECK (status IN ('INVITED','ACTIVE','DISABLED')),
    invite_token      VARCHAR(64),
    invite_expires_at TIMESTAMPTZ,
    last_active_at    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admins_status ON admins (status);

-- Single super admin invariant: at most one row may ever carry role SUPER_ADMIN.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_single_super_admin
    ON users (role) WHERE role = 'SUPER_ADMIN';

-- Promote the V2 demo admin to the platform's single super admin.
UPDATE users SET role = 'SUPER_ADMIN'
 WHERE email = 'nadia@turfchai.com' AND role = 'ADMIN';

INSERT INTO admins (user_id, admin_role, permissions, appointed_by, status)
SELECT id, 'SUPER',
       '{"perm_review":true,"perm_listings":true,"perm_users":true,"perm_reports":true}',
       NULL, 'ACTIVE'
  FROM users WHERE email = 'nadia@turfchai.com'
ON CONFLICT (user_id) DO NOTHING;

-- Demo admins (password: TurfChai@123) — Farid: verification, Tania: support.
INSERT INTO users (public_id, full_name, email, phone, password_hash, role, status,
                   avatar_initials, reliability_score, email_verified_at)
SELECT gen_random_uuid(), 'Farid Hasan', 'farid@turfchai.com', '+8801712000004',
       '$2a$10$1LSfwMnNFBOgMddnwnnk3uB2oAhqIgLjs6QexAfJZBPQmZWo5F1XO',
       'ADMIN', 'ACTIVE', 'FH', 100, now()
 WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'farid@turfchai.com');

INSERT INTO users (public_id, full_name, email, phone, password_hash, role, status,
                   avatar_initials, reliability_score, email_verified_at)
SELECT gen_random_uuid(), 'Tania Sultana', 'tania@turfchai.com', '+8801710000005',
       '$2a$10$XquHnPHWx5Yf3J68tdHetOEmDiKdHRzSmOqp8DUhgI.J0BEYFvSQK',
       'ADMIN', 'ACTIVE', 'TS', 100, now()
 WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'tania@turfchai.com');

INSERT INTO admins (user_id, admin_role, permissions, appointed_by, status)
SELECT id, 'VERIFICATION',
       '{"perm_review":true,"perm_listings":true,"perm_users":false,"perm_reports":false}',
       (SELECT id FROM users WHERE email = 'nadia@turfchai.com'), 'ACTIVE'
  FROM users WHERE email = 'farid@turfchai.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO admins (user_id, admin_role, permissions, appointed_by, status)
SELECT id, 'SUPPORT',
       '{"perm_review":false,"perm_listings":false,"perm_users":true,"perm_reports":false}',
       (SELECT id FROM users WHERE email = 'nadia@turfchai.com'), 'ACTIVE'
  FROM users WHERE email = 'tania@turfchai.com'
ON CONFLICT (user_id) DO NOTHING;
