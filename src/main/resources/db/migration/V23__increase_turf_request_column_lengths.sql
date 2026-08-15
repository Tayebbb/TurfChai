-- ============================================================================
-- V23: Increase document column capacities in turf_requests table
-- Prevents 500 Internal Server Error when document CDN URLs exceed 30 or 60 chars
-- ============================================================================

ALTER TABLE turf_requests ALTER COLUMN doc_trade_license TYPE VARCHAR(500);
ALTER TABLE turf_requests ALTER COLUMN doc_utility_bill TYPE VARCHAR(500);
ALTER TABLE turf_requests ALTER COLUMN owner_phone TYPE VARCHAR(30);
ALTER TABLE turf_requests ALTER COLUMN owner_email TYPE VARCHAR(150);
