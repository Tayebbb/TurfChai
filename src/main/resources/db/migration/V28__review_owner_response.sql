-- ============================================================================
-- V28: Owner responses on reviews
--
-- The owner Reviews page has a "Publish response" control. Until now there was
-- nowhere to store the response, so the button only raised a toast. These
-- columns back the real POST /api/v1/owner/reviews/{id}/response endpoint and
-- the response is surfaced on the public venue page.
-- ============================================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS owner_response VARCHAR(2000);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS owner_responded_at TIMESTAMP WITH TIME ZONE;
