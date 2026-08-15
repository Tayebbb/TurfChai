-- ============================================================================
-- 26. LOYALTY TIERS: four-rung ladder (Bronze / Silver / Gold / Platinum)
--     Thresholds per the loyalty program spec: 0 / 500 / 1500 / 5000 points.
--     Replaces the V1 baseline's three SILVER/GOLD/PLATINUM rows and relaxes
--     the ck_tiers_name check constraint to admit BRONZE.
-- ============================================================================

ALTER TABLE loyalty_tiers DROP CONSTRAINT IF EXISTS ck_tiers_name;

UPDATE loyalty_tiers SET name = 'BRONZE',  min_points = 0,    discount_percent = 0.00,
    perks = '{"priority_booking":false,"free_extension_min":0}', sort_order = 1
WHERE name = 'SILVER';

UPDATE loyalty_tiers SET name = 'SILVER',  min_points = 500,  discount_percent = 5.00,
    perks = '{"priority_booking":false,"free_extension_min":15}', sort_order = 2
WHERE name = 'GOLD';

UPDATE loyalty_tiers SET name = 'GOLD',    min_points = 1500, discount_percent = 10.00,
    perks = '{"priority_booking":false,"free_extension_min":30}', sort_order = 3
WHERE name = 'PLATINUM';

INSERT INTO loyalty_tiers (name, min_points, discount_percent, perks, sort_order)
VALUES ('PLATINUM', 5000, 15.00, '{"priority_booking":true,"free_extension_min":30}', 4);

ALTER TABLE loyalty_tiers ADD CONSTRAINT ck_tiers_name CHECK (name IN ('BRONZE','SILVER','GOLD','PLATINUM'));