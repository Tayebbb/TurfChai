-- V40: Sync venue ratings and review counts directly from reviews table
UPDATE venues v
SET 
    rating_avg = COALESCE((
        SELECT ROUND(AVG(r.overall_rating)::numeric, 2)
        FROM reviews r
        WHERE r.venue_id = v.id AND r.status = 'PUBLISHED'
    ), v.rating_avg, 0.0),
    review_count = COALESCE((
        SELECT COUNT(r.id)::int
        FROM reviews r
        WHERE r.venue_id = v.id AND r.status = 'PUBLISHED'
    ), v.review_count, 0)
WHERE EXISTS (
    SELECT 1 FROM reviews r WHERE r.venue_id = v.id
);
