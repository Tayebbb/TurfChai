-- ============================================================================
-- V11: ML Pricing Engine — holiday_calendar, weather_forecast_grid,
--      and generated grid columns on venues.
-- ============================================================================

-- 1. Holiday Calendar
--    Used by the ONNX pricing model to detect public holidays.
--    The Nager.Date API monthly sync populates most rows; admins can
--    manually insert lunar/religious dates via the admin panel.
CREATE TABLE IF NOT EXISTS holiday_calendar (
    holiday_date        DATE          NOT NULL PRIMARY KEY,
    description         VARCHAR(200)  NOT NULL,
    is_manual_override  BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  holiday_calendar IS 'Public & religious holidays used by the ML pricing model';
COMMENT ON COLUMN holiday_calendar.is_manual_override IS 'TRUE = admin-added; Nager sync will never overwrite this row';

-- 2. Weather Forecast Grid
--    Pre-fetched 14-day hourly forecasts, rounded to a 0.01° grid
--    so every venue maps to the nearest grid point.
--    weather_condition: 0=Clear, 1=Cloudy, 2=Rain
CREATE TABLE IF NOT EXISTS weather_forecast_grid (
    rounded_latitude    NUMERIC(5,2)  NOT NULL,
    rounded_longitude   NUMERIC(5,2)  NOT NULL,
    forecast_datetime   TIMESTAMPTZ   NOT NULL,
    weather_condition   SMALLINT      NOT NULL DEFAULT 0
                        CHECK (weather_condition IN (0, 1, 2)),

    PRIMARY KEY (rounded_latitude, rounded_longitude, forecast_datetime)
);

CREATE INDEX IF NOT EXISTS idx_weather_grid_datetime
    ON weather_forecast_grid (forecast_datetime);

COMMENT ON TABLE  weather_forecast_grid IS '14-day rolling hourly weather forecasts per 0.01° grid cell';
COMMENT ON COLUMN weather_forecast_grid.weather_condition IS '0=Clear, 1=Cloudy, 2=Rain (mapped from WMO codes)';

-- 3. Generated grid columns on venues
--    Rounds the venue lat/lng to 2 decimal places so we can join directly
--    against weather_forecast_grid without computing at query time.
--    PostgreSQL GENERATED ALWAYS AS … STORED columns.
ALTER TABLE venues ADD COLUMN IF NOT EXISTS grid_lat NUMERIC(5,2)
    GENERATED ALWAYS AS (ROUND(lat, 2)) STORED;

ALTER TABLE venues ADD COLUMN IF NOT EXISTS grid_lon NUMERIC(5,2)
    GENERATED ALWAYS AS (ROUND(lng, 2)) STORED;

CREATE INDEX IF NOT EXISTS idx_venues_grid ON venues (grid_lat, grid_lon)
    WHERE status = 'LIVE';
