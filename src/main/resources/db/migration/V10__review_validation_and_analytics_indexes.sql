-- Review payload integrity and indexes used by the administration analytics
-- endpoints.  V1 creates the complete baseline; this migration is safe for
-- databases that have already applied that baseline.

ALTER TABLE reviews
    ADD CONSTRAINT ck_reviews_sub_ratings_object
    CHECK (jsonb_typeof(sub_ratings) = 'object');

-- Date-bounded revenue aggregation only scans completed/revenue-bearing rows.
CREATE INDEX IF NOT EXISTS idx_bookings_analytics_revenue
    ON bookings (created_at)
    INCLUDE (net_amount, slot_id)
    WHERE status IN ('CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'COMPLETED');

-- Supports denominator selection in the turf-utilisation query.
CREATE INDEX IF NOT EXISTS idx_slots_analytics_utilization
    ON slots (slot_date, id);
