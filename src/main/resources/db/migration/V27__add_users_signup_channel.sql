-- ============================================================================
-- 27. ADD USERS.SIGNUP_CHANNEL: acquisition-source dimension for the admin
--     Acquisition Channels breakdown. Nullable so existing rows stay valid;
--     defaults to 'Organic' for new signups.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_channel VARCHAR(40) DEFAULT 'Organic';