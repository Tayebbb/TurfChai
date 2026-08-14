-- ============================================================================
-- V20: Allow INACTIVE status for users table
-- ============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_status;
ALTER TABLE users ADD CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE','PENDING','INACTIVE','SUSPENDED','DELETED'));
