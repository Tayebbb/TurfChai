-- ============================================================================
-- V7: Fix schema traps that only surface on PostgreSQL
--
-- The dev profile runs H2 with ddl-auto=update and Flyway disabled, so these
-- mismatches between the JPA entities and the V1 baseline passed every local
-- run and every test while being guaranteed failures in production.
-- ============================================================================

-- 1. sport_pricing_rules.days_of_week is NOT NULL with no default and is not
--    mapped by SportPricingRule, so every insert fails. Default to all days.
ALTER TABLE sport_pricing_rules
    ALTER COLUMN days_of_week SET DEFAULT '{1,2,3,4,5,6,7}';

UPDATE sport_pricing_rules SET days_of_week = '{1,2,3,4,5,6,7}' WHERE days_of_week IS NULL;

-- 2. tournaments.invite_code is VARCHAR(32), but generated codes are
--    "t/" + slugified-name + "-" + 4 digits, which overflows for ordinary
--    tournament names. The entity already declares 40.
ALTER TABLE tournaments
    ALTER COLUMN invite_code TYPE VARCHAR(64);
