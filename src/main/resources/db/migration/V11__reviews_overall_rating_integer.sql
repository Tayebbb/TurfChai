-- ============================================================================
-- V11: Align reviews table columns with the Review entity
--
-- V1__baseline.sql defines overall_rating as SMALLINT (1..5) and tags as
-- VARCHAR(30)[], but the Review entity maps overallRating to Integer and tags
-- to a JSON list. With spring.jpa.hibernate.ddl-auto=validate both mismatches
-- fail every fresh-database boot:
--   wrong column type encountered in column [overall_rating] in table
--   [reviews]; found [int2], but expecting [integer]
--   wrong column type encountered in column [tags] in table [reviews];
--   found [_varchar (Types#ARRAY)], but expecting [jsonb (Types#JSON)]
-- Widening/converting never loses data; re-running is a no-op.
-- ============================================================================

ALTER TABLE reviews ALTER COLUMN overall_rating TYPE INTEGER;

-- Convert the text array to JSONB (to_jsonb keeps existing values as a JSON
-- array). The old array default must be dropped first — Postgres refuses to
-- cast a column default across types — then restored as JSONB.
ALTER TABLE reviews ALTER COLUMN tags DROP DEFAULT;
ALTER TABLE reviews ALTER COLUMN tags TYPE JSONB USING to_jsonb(tags);
ALTER TABLE reviews ALTER COLUMN tags SET DEFAULT '[]'::jsonb;

-- users.failed_login_count: SMALLINT -> INTEGER (entity maps to Integer)
ALTER TABLE users ALTER COLUMN failed_login_count TYPE INTEGER;

-- venues: SMALLINT -> INTEGER for columns that the Venue entity maps as int
ALTER TABLE venues ALTER COLUMN default_buffer_min TYPE INTEGER;
ALTER TABLE venues ALTER COLUMN minimum_refund_hours TYPE INTEGER;
ALTER TABLE venues ALTER COLUMN refund_window_full_hours TYPE INTEGER;
