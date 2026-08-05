-- ============================================================================
-- V2: Seed demo users (idempotent)
--   nadia@turfchai.com  ADMIN      password: TurfChai@123
--   rafi@turfchai.com   PLAYER     password: TurfChai@123
--   mahmud@turfchai.com OWNER      password: TurfChai@123
-- Passwords are BCrypt hashes of "TurfChai@123". Replace in real prod envs.
-- ============================================================================

INSERT INTO users (public_id, full_name, email, phone, password_hash, role, status,
                   avatar_initials, reliability_score, email_verified_at)
VALUES
    (gen_random_uuid(), 'Nadia Amin',    'nadia@turfchai.com',    '+8801712000001',
     '$2b$10$7E9QbFnRzztThCUjHskE4OTX1WNzEScGt/W1cw6Mn3PEU1o4ChhMG', 'ADMIN',  'ACTIVE', 'NA', 100, now()),
    (gen_random_uuid(), 'Rafiul Karim',  'rafi@turfchai.com',     '+8801712000002',
     '$2b$10$CuAr2DLoNIRrx0NHMWj1Gei3AIhOg.ajUq08yDuOJmLMSENzBGEaW', 'PLAYER', 'ACTIVE', 'RK', 98,  now()),
    (gen_random_uuid(), 'Mahmud Hasan',  'mahmud@turfchai.com',   '+8801712000003',
     '$2b$10$Z39KwFEwghZd12G2ItcKZuTQ3PgdOtY4PQiGojO1R3F80BDn4mUDW', 'OWNER',  'ACTIVE', 'MH', 100, now())
ON CONFLICT (email) DO NOTHING;
