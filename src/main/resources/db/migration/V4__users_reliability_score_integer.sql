-- ============================================================================
-- V4: Widen users.reliability_score to INTEGER
--   The User entity maps reliabilityScore as Integer, but V1 defined the column
--   as SMALLINT, which fails Hibernate's ddl-auto=validate on startup.
--   SMALLINT was the original schema intent, but the Java model owns the type;
--   align the column to the entity instead.
-- ============================================================================

ALTER TABLE users ALTER COLUMN reliability_score TYPE INTEGER;
