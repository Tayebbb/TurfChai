#!/usr/bin/env bash
# TurfChai — local PostgreSQL bootstrap for developers.
#
# Creates (or updates) the app role and database on YOUR local PostgreSQL so
# that `./mvnw spring-boot:run` connects successfully. Safe to re-run.
#
# Usage:
#   ./scripts/setup-db.sh                 # defaults (turfchai / turfchai_dev)
#   DB_PASSWORD=s3cret ./scripts/setup-db.sh
#
# Requires `sudo` access to the `postgres` OS user (standard on Ubuntu).
set -euo pipefail

DB_USER="${DB_USER:-turfchai}"
DB_NAME="${DB_NAME:-turfchai}"
DB_PASSWORD="${DB_PASSWORD:-turfchai_dev}"

if [ -z "$DB_PASSWORD" ]; then
  echo "error: DB_PASSWORD must not be empty" >&2
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "error: this script needs 'sudo' to run psql as the postgres user" >&2
  exit 1
fi

if ! sudo -n -u postgres true 2>/dev/null; then
  echo "note: sudo will prompt for your password once (needed to reach the postgres OS user)."
fi

echo "==> Ensuring role '${DB_USER}' and database '${DB_NAME}' on localhost ..."

# Single quotes in the password would break the SQL literal below.
if [[ "$DB_PASSWORD" == *"'"* ]]; then
  echo "error: DB_PASSWORD must not contain single quotes" >&2
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 --quiet <<SQL
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
      RAISE NOTICE 'role ${DB_USER} created';
   ELSE
      ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
      RAISE NOTICE 'role ${DB_USER} already existed — password synced';
   END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

echo "==> Done. Connection: postgresql://${DB_USER}@localhost:5432/${DB_NAME}"
echo "    Tip: mirror DB_PASSWORD in your .env file (see .env.example)."
