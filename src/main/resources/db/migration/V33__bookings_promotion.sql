-- A booking records the promo code it redeemed and what that code was worth, so
-- the owner ledger reconciles and a cancellation can hand the redemption back.
ALTER TABLE bookings ADD COLUMN
IF NOT EXISTS promo_code VARCHAR
(30);
ALTER TABLE bookings ADD COLUMN
IF NOT EXISTS discount_amount NUMERIC
(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX
IF NOT EXISTS ix_bookings_promo_code ON bookings
(promo_code);
