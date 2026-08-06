-- Add missing columns to turf_requests for the new admin UI
ALTER TABLE turf_requests
    ADD COLUMN IF NOT EXISTS pitch_count INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS sports_csv VARCHAR(255) DEFAULT 'Football',
    ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS owner_email VARCHAR(150),
    ADD COLUMN IF NOT EXISTS doc_utility_bill VARCHAR(30) DEFAULT 'PENDING';

-- Rename existing columns to match the new entity fields (if they haven't been renamed yet)
DO $$
BEGIN
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='turf_requests' AND column_name='name') THEN
        ALTER TABLE turf_requests RENAME COLUMN name TO venue_name;
    END IF;
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='turf_requests' AND column_name='review_note') THEN
        ALTER TABLE turf_requests RENAME COLUMN review_note TO admin_note;
    END IF;
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='turf_requests' AND column_name='reviewed_by_admin_id') THEN
        ALTER TABLE turf_requests RENAME COLUMN reviewed_by_admin_id TO reviewed_by;
    END IF;
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='turf_requests' AND column_name='trade_license_number') THEN
        ALTER TABLE turf_requests RENAME COLUMN trade_license_number TO doc_trade_license;
    END IF;
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='turf_requests' AND column_name='nid_document_url') THEN
        ALTER TABLE turf_requests RENAME COLUMN nid_document_url TO doc_owner_nid;
    END IF;
END $$;

-- Add missing columns to payouts for the new admin UI
ALTER TABLE payouts
    ADD COLUMN IF NOT EXISTS payout_code VARCHAR(16) UNIQUE,
    ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS bank_account_id BIGINT, -- We will ignore the old JSONB bank_account column
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BDT',
    ADD COLUMN IF NOT EXISTS settled_by BIGINT REFERENCES users(id);

-- Rename existing columns in payouts
DO $$
BEGIN
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='payouts' AND column_name='anomaly_note') THEN
        ALTER TABLE payouts RENAME COLUMN anomaly_note TO anomaly_reason;
    END IF;
END $$;

-- In payouts, anomaly_flag is currently a VARCHAR. Let's add a boolean flag for the entity.
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS anomaly_flag_bool BOOLEAN NOT NULL DEFAULT FALSE;

-- Add link column to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(255);

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_user_id  BIGINT NOT NULL REFERENCES users(id),
    bank_name      VARCHAR(100) NOT NULL,
    account_name   VARCHAR(100) NOT NULL,
    account_number VARCHAR(40) NOT NULL,
    routing_number VARCHAR(20),
    is_primary     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed demo turf requests so the admin UI has data to work with
INSERT INTO turf_requests (request_code, owner_user_id, venue_name, area, pitch_count, sports_csv,
                           owner_phone, owner_email, doc_trade_license, doc_owner_nid, doc_utility_bill, status)
SELECT 'TR-1042', u.id, 'Kick Off Arena', 'Dhanmondi', 3, 'Football,Futsal',
       '+880 1811 344 123', 'mahmudul@kickoff.com', 'VERIFIED', 'VERIFIED', 'VERIFIED', 'PENDING'
  FROM users u WHERE u.email = 'mahmud@turfchai.com'
ON CONFLICT (request_code) DO NOTHING;

INSERT INTO turf_requests (request_code, owner_user_id, venue_name, area, pitch_count, sports_csv,
                           owner_phone, owner_email, doc_trade_license, doc_owner_nid, doc_utility_bill, status)
SELECT 'TR-1041', u.id, 'Uttara Champions Field', 'Uttara 11', 2, 'Football',
       '+880 1717 505 800', 'salma@champions.com', 'VERIFIED', 'VERIFIED', 'VERIFIED', 'PENDING'
  FROM users u WHERE u.email = 'mahmud@turfchai.com'
ON CONFLICT (request_code) DO NOTHING;
