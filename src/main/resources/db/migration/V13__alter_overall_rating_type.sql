-- Alter reviews.overall_rating type to match the JPA entity type (Integer)
ALTER TABLE reviews ALTER COLUMN overall_rating TYPE INTEGER;

-- Alter reviews.tags type to match the JPA entity type (JSONB)
ALTER TABLE reviews ALTER COLUMN tags DROP DEFAULT;
ALTER TABLE reviews ALTER COLUMN tags TYPE JSONB USING to_jsonb(tags);
ALTER TABLE reviews ALTER COLUMN tags SET DEFAULT '[]'::jsonb;
