-- ============================================================================
-- V45: Remove the personal demo admins; Nadia is the single demo super admin
--
-- The shahadat.cse.20230104008@aust.edu account was the demo super admin.
-- Email delivery has been removed from the app entirely (admin 2FA now runs
-- in demo mode: the code is shown on screen), and the personal address must
-- stop being attached to the demo. Nadia (the original V2 demo admin) becomes
-- the one demo super admin, keeping every SUPER_ADMIN-gated feature usable.
--
-- Idempotent: every step is a no-op on databases that never had the accounts.
-- ============================================================================

DO $$
DECLARE
    v_target_id BIGINT;
    v_shahadat_id BIGINT;
BEGIN
    SELECT id INTO v_target_id FROM users WHERE email = 'nadia@turfchai.com' LIMIT 1;
    SELECT id INTO v_shahadat_id FROM users WHERE email = 'shahadat.cse.20230104008@aust.edu' LIMIT 1;

    -- 1. Re-point admin metadata the outgoing account appointed.
    IF v_shahadat_id IS NOT NULL THEN
        UPDATE admins SET appointed_by = v_target_id WHERE appointed_by = v_shahadat_id;
    END IF;

    -- 2. Remove the outgoing account's admin row, then the user itself
    --    (must happen before any promotion: uq_users_single_super_admin
    --    allows at most one SUPER_ADMIN row in users).
    IF v_shahadat_id IS NOT NULL THEN
        DELETE FROM admins WHERE user_id = v_shahadat_id;
        DELETE FROM users WHERE id = v_shahadat_id;
    END IF;

    -- 3. Demote any remaining super admins so the target is the single one.
    UPDATE users SET role = 'ADMIN' WHERE role = 'SUPER_ADMIN' AND id <> v_target_id;
    UPDATE admins SET admin_role = 'VERIFICATION' WHERE admin_role = 'SUPER' AND user_id <> v_target_id;

    -- 4. Promote Nadia to the single demo super admin.
    IF v_target_id IS NOT NULL THEN
        UPDATE users SET role = 'SUPER_ADMIN', status = 'ACTIVE'
         WHERE id = v_target_id AND role <> 'SUPER_ADMIN';

        INSERT INTO admins (user_id, admin_role, permissions, appointed_by, status)
        SELECT v_target_id, 'SUPER',
               '{"perm_review":true,"perm_listings":true,"perm_users":true,"perm_reports":true,"all":true}',
               NULL, 'ACTIVE'
        ON CONFLICT (user_id) DO UPDATE
            SET admin_role = 'SUPER',
                permissions = EXCLUDED.permissions,
                status = 'ACTIVE';
    END IF;

    -- 5. Same treatment for the secondary personal demo admin.
    DELETE FROM admins a USING users u
      WHERE a.user_id = u.id AND u.email = 'fazle.rabbi.mugdho@gmail.com';
    DELETE FROM users WHERE email = 'fazle.rabbi.mugdho@gmail.com';
END $$;
