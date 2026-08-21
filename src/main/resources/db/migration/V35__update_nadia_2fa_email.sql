-- ============================================================================
-- V35: Update Nadia Admin 2FA Email to shahadat.cse.20230104008@aust.edu
-- Ensures 2FA OTP codes for the admin account are delivered to shahadat.cse.20230104008@aust.edu
-- ============================================================================

DO $$
BEGIN
    -- If nadia@turfchai.com exists and shahadat.cse.20230104008@aust.edu does not exist, rename
    IF EXISTS (SELECT 1 FROM users WHERE email = 'nadia@turfchai.com')
       AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'shahadat.cse.20230104008@aust.edu') THEN
        UPDATE users
           SET email = 'shahadat.cse.20230104008@aust.edu'
         WHERE email = 'nadia@turfchai.com';
    ELSIF EXISTS (SELECT 1 FROM users WHERE email = 'nadia@turfchai.com')
       AND EXISTS (SELECT 1 FROM users WHERE email = 'shahadat.cse.20230104008@aust.edu') THEN
        -- Both exist: ensure shahadat account is active admin and update nadia
        UPDATE users
           SET role = 'ADMIN', status = 'ACTIVE'
         WHERE email = 'shahadat.cse.20230104008@aust.edu';
        
        -- Delete redundant nadia row if orphaned or cascade admins
        DELETE FROM admins WHERE user_id IN (SELECT id FROM users WHERE email = 'nadia@turfchai.com');
        DELETE FROM users WHERE email = 'nadia@turfchai.com';
    ELSE
        -- Insert shahadat.cse.20230104008@aust.edu as admin if missing
        INSERT INTO users (public_id, full_name, email, phone, password_hash, role, status, avatar_initials, reliability_score, email_verified_at)
        VALUES (gen_random_uuid(), 'Shahadat Hossain', 'shahadat.cse.20230104008@aust.edu', '+8801712000008',
                '$2a$10$1LSfwMnNFBOgMddnwnnk3uB2oAhqIgLjs6QexAfJZBPQmZWo5F1XO', 'ADMIN', 'ACTIVE', 'SH', 100, now())
        ON CONFLICT (email) DO NOTHING;
    END IF;

    -- Ensure admin metadata entry exists
    INSERT INTO admins (user_id, admin_role, permissions, status)
    SELECT id, 'SUPER', '{"perm_review":true,"perm_listings":true,"perm_users":true,"perm_reports":true}', 'ACTIVE'
      FROM users WHERE email = 'shahadat.cse.20230104008@aust.edu'
    ON CONFLICT (user_id) DO NOTHING;
END $$;
