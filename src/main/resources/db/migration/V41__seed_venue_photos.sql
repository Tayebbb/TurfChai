-- V41: Seed / back-fill photos_csv for venues that currently have none
UPDATE venues
SET photos_csv = CASE (id % 6)
    WHEN 0 THEN 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80,https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80,https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80,https://images.unsplash.com/photo-1518604667503-465ac943e86c?w=800&q=80'
    WHEN 3 THEN 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&q=80,https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'
    WHEN 4 THEN 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=800&q=80,https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=800&q=80'
    ELSE 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80,https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80'
END
WHERE photos_csv IS NULL OR photos_csv = '';
