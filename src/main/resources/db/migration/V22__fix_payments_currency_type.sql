-- ============================================================================
-- V22: Alter payments.currency column type from CHAR(3) to VARCHAR(3)
-- Matches JPA Entity type (String) in com.turfchai.payment.entity.Payment
-- ============================================================================

ALTER TABLE payments ALTER COLUMN currency TYPE VARCHAR(3);
