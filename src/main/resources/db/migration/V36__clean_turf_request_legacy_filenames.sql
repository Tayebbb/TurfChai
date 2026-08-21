-- ============================================================================
-- V36: Clean legacy document filenames in turf_requests table
-- Resets un-stored raw filenames to 'PENDING' so they indicate pending re-submission
-- ============================================================================

UPDATE turf_requests
SET doc_trade_license = 'PENDING'
WHERE doc_trade_license IS NOT NULL
  AND doc_trade_license != 'VERIFIED'
  AND doc_trade_license != 'PENDING'
  AND doc_trade_license NOT LIKE 'http://%'
  AND doc_trade_license NOT LIKE 'https://%'
  AND doc_trade_license NOT LIKE 'data:%';

UPDATE turf_requests
SET doc_utility_bill = 'PENDING'
WHERE doc_utility_bill IS NOT NULL
  AND doc_utility_bill != 'VERIFIED'
  AND doc_utility_bill != 'PENDING'
  AND doc_utility_bill NOT LIKE 'http://%'
  AND doc_utility_bill NOT LIKE 'https://%'
  AND doc_utility_bill NOT LIKE 'data:%';
