-- ============================================================================
-- V24: Fix admin passwords & roles for demo users
-- Idempotently insert/update demo accounts into users & admins tables
-- Shahadat: SUPER_ADMIN, Nadia: ADMIN, Mahmud: OWNER, Rafi: PLAYER
-- ============================================================================

INSERT INTO users (public_id, full_name, email, phone, password_hash, role, status, avatar_initials, reliability_score, email_verified_at)
VALUES (gen_random_uuid(), 'Shahadat Hossain', 'shahadat.cse.20230104008@aust.edu', '+8801712000008',
        '$2a$10$1LSfwMnNFBOgMddnwnnk3uB2oAhqIgLjs6QexAfJZBPQmZWo5F1XO', 'SUPER_ADMIN', 'ACTIVE', 'SH', 100, now())
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

INSERT INTO users (public_id, full_name, email, phone, password_hash, role, status, avatar_initials, reliability_score, email_verified_at)
VALUES (gen_random_uuid(), 'Nadia Amin', 'nadia@turfchai.com', '+8801712000001',
        '$2a$10$1LSfwMnNFBOgMddnwnnk3uB2oAhqIgLjs6QexAfJZBPQmZWo5F1XO', 'ADMIN', 'ACTIVE', 'NA', 100, now())
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

INSERT INTO users (public_id, full_name, email, phone, password_hash, role, status, avatar_initials, reliability_score, email_verified_at)
VALUES (gen_random_uuid(), 'Mahmud Hasan', 'mahmud@turfchai.com', '+8801712000003',
        '$2a$10$1LSfwMnNFBOgMddnwnnk3uB2oAhqIgLjs6QexAfJZBPQmZWo5F1XO', 'OWNER', 'ACTIVE', 'MH', 100, now())
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

INSERT INTO users (public_id, full_name, email, phone, password_hash, role, status, avatar_initials, reliability_score, email_verified_at)
VALUES (gen_random_uuid(), 'Rafiul Karim', 'rafi@turfchai.com', '+8801712000002',
        '$2a$10$1LSfwMnNFBOgMddnwnnk3uB2oAhqIgLjs6QexAfJZBPQmZWo5F1XO', 'PLAYER', 'ACTIVE', 'RK', 100, now())
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

INSERT INTO admins (user_id, admin_role, permissions, status)
SELECT id, 'SUPER', '{"perm_review":true,"perm_listings":true,"perm_users":true,"perm_reports":true}', 'ACTIVE'
  FROM users WHERE email = 'shahadat.cse.20230104008@aust.edu'
ON CONFLICT (user_id) DO NOTHING;
