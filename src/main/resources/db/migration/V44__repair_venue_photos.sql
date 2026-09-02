-- V44: repair venue photos
--
-- Two problems with the data V41 / the demo seeders produced:
--   1. Two of the ten Unsplash source images now return 404
--      (photo-1508098682722-e99c43a406b2, photo-1518604667503-465ac943e86c),
--      so every gallery built from them serves a broken image.
--   2. Venues created by the dev-only VenueDataSeeder (which sets no photos)
--      landed in this database AFTER V41 had already run, so the "fill what
--      is empty" back-fill in V41 never saw them and they stayed NULL —
--      and they are the highest-rated venues, i.e. the homepage cards.
--
-- Idempotent: dead-URL REPLACE is a no-op on rows without them; the
-- back-fill only touches rows whose photos_csv is still NULL/empty.

UPDATE venues
SET photos_csv = REPLACE(photos_csv,
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2',
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5')
WHERE photos_csv LIKE '%photo-1508098682722-e99c43a406b2%';

UPDATE venues
SET photos_csv = REPLACE(photos_csv,
    'https://images.unsplash.com/photo-1518604667503-465ac943e86c',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211')
WHERE photos_csv LIKE '%photo-1518604667503-465ac943e86c%';

UPDATE venues
SET photos_csv = CASE (id % 6)
    WHEN 0 THEN 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80,https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80,https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80,https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80'
    WHEN 3 THEN 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&q=80,https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'
    WHEN 4 THEN 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=800&q=80,https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=800&q=80'
    ELSE 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80,https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80'
END
WHERE photos_csv IS NULL OR photos_csv = '';
