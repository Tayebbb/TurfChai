#!/usr/bin/env bash
#
# CI smoke test: exercises the admin 2FA login flow and RBAC rules against a
# running backend. Used by .github/workflows/ci.yml (boot-smoke job) and can be
# run locally:  BASE_URL=http://localhost:8081 ./scripts/ci-smoke.sh
#
# Requires: curl + jq. Admin credentials come from the AdminDataSeeder account
# (seeded in dev/test/ci profiles). Exits non-zero on the first failed check.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
EMAIL="${SMOKE_ADMIN_EMAIL:-fazle.rabbi.mugdho@gmail.com}"
PASSWORD="${SMOKE_ADMIN_PASSWORD:-TurfChai@123}"
HEALTH_URL="${BASE_URL}/api/v1/health"
TIMEOUT_SECS="${SMOKE_TIMEOUT_SECS:-180}"

PASSED=0
FAILED=0

say()  { printf '\n== %s\n' "$*"; }
pass() { printf 'PASS  %s\n' "$*"; PASSED=$((PASSED + 1)); }
fail() { printf 'FAIL  %s\n' "$*"; FAILED=$((FAILED + 1)); }

request() {
  # request <method> <path> [data|token] -> prints HTTP status
  local method="$1" path="$2" data="${3:-}" token="${4:-}"
  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" "${BASE_URL}${path}" -H 'Content-Type: application/json')
  [[ -n "$data" ]] && args+=(-d "$data")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer ${token}")
  curl "${args[@]}"
}

json_request() {
  # json_request <method> <path> [data|token] -> prints response body
  local method="$1" path="$2" data="${3:-}" token="${4:-}"
  local args=(-s -X "$method" "${BASE_URL}${path}" -H 'Content-Type: application/json')
  [[ -n "$data" ]] && args+=(-d "$data")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer ${token}")
  curl "${args[@]}"
}

check_health() {
  say "Waiting for health endpoint (up to ${TIMEOUT_SECS}s)"
  local deadline=$((SECONDS + TIMEOUT_SECS))
  while (( SECONDS < deadline )); do
    if [[ "$(curl -s -o /dev/null -w '%{http_code}' "${HEALTH_URL}")" == "200" ]]; then
      pass "health endpoint responds 200"
      return 0
    fi
    sleep 3
  done
  fail "health endpoint did not respond 200 within ${TIMEOUT_SECS}s"
  return 1
}

smoke_admin_auth() {
  say "Admin 2FA flow"
  local status challenge dev_code token

  status=$(request POST /api/v1/admin/auth/login "{\"email\":\"${EMAIL}\",\"password\":\"definitely-wrong\"}")
  if [[ "$status" == "401" ]]; then
    pass "wrong password rejected with 401"
  else
    fail "wrong password expected 401, got ${status}"
  fi

  local challenge_body
  challenge_body=$(json_request POST /api/v1/admin/auth/login "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
  challenge=$(jq -r '.challenge // empty' <<<"$challenge_body")
  dev_code=$(jq -r '.devCode // empty' <<<"$challenge_body")

  if [[ -n "$challenge" && -n "$dev_code" ]]; then
    pass "challenge issued (ttl=$(jq -r '.ttlSeconds' <<<"$challenge_body")s, devCode present)"
  else
    fail "challenge response missing challenge/devCode: $challenge_body"
    return 1
  fi

  status=$(request POST /api/v1/admin/auth/login/verify "{\"challenge\":\"${challenge}\",\"code\":\"000000\"}")
  if [[ "$status" == "400" ]]; then
    pass "wrong OTP rejected with 400"
  else
    fail "wrong OTP expected 400, got ${status}"
  fi

  local verify_body
  verify_body=$(json_request POST /api/v1/admin/auth/login/verify "{\"challenge\":\"${challenge}\",\"code\":\"${dev_code}\"}")
  token=$(jq -r '.token // empty' <<<"$verify_body")
  if [[ -n "$token" ]]; then
    pass "valid OTP yields JWT (role=$(jq -r '.user.role // "?"' <<<"$verify_body"))"
  else
    fail "valid OTP did not yield a token: $verify_body"
    return 1
  fi

  status=$(request GET /api/v1/admin/admins "" "$token")
  if [[ "$status" == "200" ]]; then
    pass "SUPER_ADMIN can list admins (200)"
  else
    fail "list admins expected 200, got ${status}"
  fi

  status=$(request GET /api/v1/admin/admins)
  if [[ "$status" == "401" ]]; then
    pass "unauthenticated request rejected with 401"
  else
    fail "unauthenticated request expected 401, got ${status}"
  fi
}

smoke_player_forbidden() {
  say "RBAC: players must not reach admin endpoints"
  local email="ci.player.$RANDOM@example.com"
  local reg_body
  reg_body=$(json_request POST /api/v1/auth/register "{\"fullName\":\"CI Player\",\"email\":\"${email}\",\"phone\":\"+1000000${RANDOM:0:5}\",\"password\":\"PlayerPass@123\"}")
  local player_token
  player_token=$(jq -r '.token // empty' <<<"$reg_body")
  if [[ -z "$player_token" ]]; then
    fail "player registration failed: $reg_body"
    return 1
  fi
  pass "player registered"

  local status
  status=$(request GET /api/v1/admin/admins "" "$player_token")
  if [[ "$status" == "403" ]]; then
    pass "PLAYER role blocked from /admin/admins (403)"
  else
    fail "player access to /admin/admins expected 403, got ${status}"
  fi
}

main() {
  check_health
  smoke_admin_auth
  smoke_player_forbidden

  say "Results: ${PASSED} passed, ${FAILED} failed"
  [[ "$FAILED" -eq 0 ]]
}

main
