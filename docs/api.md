# TurfChai — API Reference

**145 endpoints**, enumerated from the `@RestController` classes in
`src/main/java`. Base path is `/api/v1` unless shown otherwise.

## Conventions

- **Auth** — `public` means no token. Everything else needs
  `Authorization: Bearer <jwt>`. Role names are the ones enforced by
  `SecurityConfig` or `@PreAuthorize`.
- **Acting user** — always taken from the token. A `userId` in a request body is
  ignored.
- **Errors** — one envelope for every failure:
  `{ "error", "message", "timestamp", "status" }`. See
  [architecture.md](architecture.md#5-error-handling) for the exception→status map.
- **Envelope** — some domains wrap payloads in `ApiResponse<T>`
  (`{ success, data, message, error }`); others return the DTO directly. The
  frontend's `api/client.js` unwraps both.

---

## Authentication

| Method | Path                       | Auth   | Purpose                                                              |
| ------ | -------------------------- | ------ | -------------------------------------------------------------------- |
| POST   | `/auth/register`           | public | Create an account (`fullName`, `email`, `password`, `phone`, `role`) |
| POST   | `/auth/login`              | public | Email + password → JWT + refresh token                               |
| POST   | `/auth/otp/request`        | public | Request a phone one-time code                                        |
| POST   | `/auth/otp/verify`         | public | Exchange phone + code for a JWT                                      |
| POST   | `/auth/refresh-token`      | public | Exchange a refresh token for a new JWT                               |
| GET    | `/auth/check-email`        | public | Whether an email is already registered                               |
| POST   | `/admin/auth/login`        | public | Admin step 1 → challenge id + one-time code                          |
| POST   | `/admin/auth/login/verify` | public | Admin step 2 → JWT                                                   |

Admin login **always** requires the second factor; challenges are single-use,
expire on a TTL, and are throttled to 5 per user per 15 minutes.

## Identity and profile

| Method | Path                                   | Auth | Purpose                                                                     |
| ------ | -------------------------------------- | ---- | --------------------------------------------------------------------------- |
| GET    | `/me`                                  | any  | The signed-in account                                                       |
| PATCH  | `/me`                                  | any  | Update the account                                                          |
| GET    | `/players/me`                          | any  | Player profile                                                              |
| PATCH  | `/players/me`                          | any  | Update profile (name, area, bio, play style, role, sports, times, position) |
| GET    | `/players/me/stats`                    | any  | Bookings, check-ins, venues played, reliability, spend, monthly counts      |
| GET    | `/players/me/saved-venues`             | any  | Saved venues                                                                |
| POST   | `/players/me/saved-venues/{venueSlug}` | any  | Save a venue                                                                |
| DELETE | `/players/me/saved-venues/{venueSlug}` | any  | Unsave a venue                                                              |

## Venue discovery

| Method | Path                             | Auth   | Purpose                                                                               |
| ------ | -------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| GET    | `/venues`                        | public | Paged catalogue; filters and `sort=rating\|name\|newest\|distance` (max page size 50) |
| GET    | `/venues/{slug}`                 | public | Venue detail with pitches and pricing rules                                           |
| GET    | `/venues/{slug}/reviews`         | public | Published reviews, newest first (max page size 50)                                    |
| GET    | `/venues/{venueId}/slots`        | public | Slots for a date                                                                      |
| GET    | `/venues/{venueId}/slots/stream` | public | Server-Sent Events stream of slot status changes                                      |
| POST   | `/pricing/quote`                 | any    | ML price quote; 503 when the model is unavailable                                     |

## Booking

| Method | Path                    | Auth                         | Purpose                                                    |
| ------ | ----------------------- | ---------------------------- | ---------------------------------------------------------- |
| POST   | `/bookings/hold-slot`   | any                          | Take a 5-minute hold (re-entrant for your own active hold) |
| POST   | `/bookings`             | any                          | Confirm a held slot                                        |
| GET    | `/bookings`             | any                          | Your bookings                                              |
| GET    | `/bookings/{id}`        | owner of booking             | One booking; 404 (not 403) when it is not yours            |
| POST   | `/bookings/{id}/cancel` | owner of booking             | Cancel and release the slot                                |
| POST   | `/matchday/checkin`     | booking owner or venue staff | Record a gate check-in                                     |

## Payments

| Method | Path                                   | Auth             | Purpose                                                                               |
| ------ | -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| POST   | `/payments/checkout`                   | any              | Pay for the held slot (`slotId`, `method`, `applyWalletAmount`, optional `promoCode`) |
| GET    | `/payments/booking/{bookingId}`        | owner of booking | Payment history, newest first                                                         |
| GET    | `/payments/refund-preview/{bookingId}` | owner of booking | Refund % and amount before cancelling                                                 |
| POST   | `/payments/cancel/{bookingId}`         | owner of booking | Cancel and record the refund by tender                                                |

`method` is one of `BKASH`, `NAGAD`, `CARD`, `CASH`. **No real gateway is
integrated** — see [decisions.md](decisions.md#payments-are-recorded-not-collected).

## Promotions

| Method | Path                                      | Auth   | Purpose                                       |
| ------ | ----------------------------------------- | ------ | --------------------------------------------- |
| POST   | `/promotions/validate-code`               | public | Quote what a code is worth for an order total |
| GET    | `/owner/venues/{venueId}/promotions`      | OWNER+ | List a venue's promotions                     |
| POST   | `/owner/venues/{venueId}/promotions`      | OWNER+ | Create a promotion                            |
| PATCH  | `/owner/venues/{venueId}/promotions/{id}` | OWNER+ | Partial update (pause, retitle, retarget)     |
| DELETE | `/owner/venues/{venueId}/promotions/{id}` | OWNER+ | Delete                                        |

Codes are unique **per venue**, so two venues may both run `SAVE20`.

## Reviews

| Method | Path                           | Auth               | Purpose                                           |
| ------ | ------------------------------ | ------------------ | ------------------------------------------------- |
| POST   | `/reviews`                     | owner of booking   | Submit a verified review for a played booking     |
| GET    | `/venues/{slug}/reviews`       | public             | Published reviews for a venue                     |
| GET    | `/owner/reviews`               | OWNER+             | Reviews across your venues, with rating breakdown |
| POST   | `/owner/reviews/{id}/response` | owner of the venue | Publish a public reply                            |

## Rewards and wallet

| Method | Path                 | Auth   | Purpose                      |
| ------ | -------------------- | ------ | ---------------------------- |
| GET    | `/rewards/products`  | public | Redeemable rewards catalogue |
| GET    | `/rewards/tiers`     | public | Loyalty tiers                |
| GET    | `/rewards/my-points` | any    | Point balance and tier       |
| GET    | `/rewards/activity`  | any    | Point ledger                 |
| GET    | `/rewards/wallet`    | any    | Wallet transactions          |
| POST   | `/rewards/redeem`    | any    | Redeem a reward              |

## Notifications

| Method | Path                          | Auth                  | Purpose                                          |
| ------ | ----------------------------- | --------------------- | ------------------------------------------------ |
| GET    | `/notifications`              | any                   | Your feed, newest first (never exposes `userId`) |
| GET    | `/notifications/unread-count` | any                   | Unread badge count                               |
| POST   | `/notifications/{id}/read`    | owner of notification | Mark one read                                    |
| POST   | `/notifications/read-all`     | any                   | Mark all of yours read                           |

## Solo / open games

| Method | Path                                                | Auth   | Purpose                                             |
| ------ | --------------------------------------------------- | ------ | --------------------------------------------------- |
| GET    | `/solo/open-games`                                  | public | Feed with `skillLevel`, `gameDate`, `query` filters |
| POST   | `/solo/open-games`                                  | any    | Post a game (organiser takes the first spot)        |
| GET    | `/solo/open-games/{id}`                             | public | One game                                            |
| GET    | `/solo/open-games/{id}/members`                     | public | Roster                                              |
| POST   | `/solo/open-games/{id}/join`                        | any    | Claim a spot                                        |
| POST   | `/solo/open-games/{id}/members/{userId}/attendance` | any    | Record attendance                                   |
| GET    | `/solo/tickets/{gameId}`                            | any    | Match ticket                                        |
| POST   | `/solo/tickets/check-in`                            | any    | Check in to a game                                  |
| GET    | `/solo/lfg-alerts`                                  | any    | Your availability alerts                            |
| POST   | `/solo/lfg-alerts`                                  | any    | Create an alert                                     |
| PUT    | `/solo/lfg-alerts/{id}/status`                      | any    | Pause / resume                                      |
| DELETE | `/solo/lfg-alerts/{id}`                             | any    | Delete                                              |
| GET    | `/solo/lfg-alerts/{id}/matches`                     | any    | Games matching the alert now                        |

## Tournaments — player side

| Method | Path                           | Auth | Purpose                                    |
| ------ | ------------------------------ | ---- | ------------------------------------------ |
| GET    | `/tournaments`                 | any  | Browse (`openOnly`, `upcomingOnly`, paged) |
| GET    | `/tournaments/me`              | any  | Your registrations                         |
| GET    | `/tournaments/{code}`          | any  | Tournament detail                          |
| POST   | `/tournaments/{code}/register` | any  | Register your team (one entry per player)  |
| DELETE | `/tournaments/{code}/register` | any  | Withdraw while the fee is unpaid           |

## Tournaments — host side

| Method | Path                                                | Auth | Purpose                                        |
| ------ | --------------------------------------------------- | ---- | ---------------------------------------------- |
| GET    | `/host/tournaments`                                 | any  | Your tournaments                               |
| POST   | `/host/tournaments`                                 | any  | Create                                         |
| GET    | `/host/tournaments/{code}`                          | any  | Full workspace view                            |
| PATCH  | `/host/tournaments/{code}/settings`                 | host | Privacy and private notes                      |
| POST   | `/host/tournaments/{code}/teams`                    | host | Add a team by hand                             |
| POST   | `/host/tournaments/{code}/teams/{teamId}/entry-fee` | host | Mark a team's fee paid                         |
| GET    | `/host/tournaments/{code}/reserve-quote`            | host | Server-priced quote for a slot selection       |
| POST   | `/host/tournaments/{code}/multi-pitch-reserve`      | host | Reserve slots across pitches, conflict-checked |
| POST   | `/host/tournaments/{code}/deposit`                  | host | Pay the deposit (amount computed server-side)  |
| POST   | `/host/tournaments/{code}/balance`                  | host | Settle the remainder                           |
| POST   | `/host/tournaments/{code}/invite-code`              | host | Rotate the invite code                         |
| GET    | `/host/tournaments/{code}/fixtures`                 | host | Bracket                                        |
| POST   | `/host/tournaments/{code}/fixtures/generate`        | host | Generate/regenerate the knockout bracket       |

## Owner — venue management

All under `/owner/**`, requiring `OWNER`, `ADMIN` or `SUPER_ADMIN`, plus a
per-row ownership check in the service.

| Method              | Path                                                                    | Purpose                                                   |
| ------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| GET / POST          | `/owner/venues`                                                         | List / create your venues                                 |
| GET / PUT           | `/owner/venues/{id}`                                                    | Read / update a venue (amenities, rules, hours, policies) |
| PUT                 | `/owner/venues/{id}/status`                                             | Publish / take offline                                    |
| GET                 | `/owner/venues/{id}/calendar`                                           | Calendar grid                                             |
| GET                 | `/owner/venues/{id}/slot-price`                                         | Effective price for a slot                                |
| POST                | `/owner/venues/{id}/manual-booking`                                     | Walk-in / phone booking                                   |
| POST / PUT / DELETE | `/owner/venues/{id}/pitches[/{pitchId}]`                                | Manage pitches                                            |
| POST / DELETE       | `/owner/venues/{id}/pricing-rules[/{ruleId}]`                           | Manage pricing rules                                      |
| POST                | `/owner/venues/{id}/slots/{slotId}/block` · `/unblock`                  | Block a slot for maintenance                              |
| GET                 | `/owner/slots` · PUT `/owner/slots/{id}` · POST `/owner/slots/generate` | Slot inventory                                            |

## Owner — operations

| Method     | Path                                                   | Purpose                                            |
| ---------- | ------------------------------------------------------ | -------------------------------------------------- |
| GET        | `/owner/analytics/dashboard`                           | KPIs, next up, activity, attention, last-7-days    |
| GET        | `/owner/bookings`                                      | Bookings across your venues                        |
| POST       | `/owner/bookings/{id}/approve` · `/cancel` · `/refund` | Act on a booking                                   |
| GET        | `/owner/customers`                                     | Customers derived from real bookings               |
| GET        | `/owner/payments`                                      | Ledger, reconciliation, method split, sport report |
| GET / POST | `/turf-requests` · `/turf-requests/upload`             | Submit a venue for verification                    |

## Admin

All under `/admin/**`, requiring `ADMIN` or `SUPER_ADMIN`.

| Method     | Path                                                                    | Purpose                                      |
| ---------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| GET        | `/admin/analytics/dashboard` · `/revenue` · `/growth` · `/segments`     | Platform analytics                           |
| POST       | `/admin/analytics/seed`                                                 | Seed demo analytics data (dev/demo profiles) |
| GET        | `/admin/audit-log`                                                      | Paged audit trail                            |
| GET        | `/admin/users`                                                          | Paged roster with role/status/search filters |
| PATCH      | `/admin/users/{id}/status` · POST `/admin/users/{id}/reinstate`         | Suspend / reinstate                          |
| GET        | `/admin/venues` · `/admin/venues/{id}` · `/admin/venues/{id}/analytics` | Venue moderation                             |
| PATCH      | `/admin/venues/{id}/status`                                             | Approve, suspend, archive                    |
| GET        | `/admin/turf-requests` · `/{code}` · POST `/{code}/review`              | Verification queue                           |
| GET        | `/admin/payouts` · `/{code}` · `/summary`                               | Payout ledger                                |
| POST       | `/admin/payouts/{code}/settle` · `/flag`                                | Settle or flag a payout                      |
| GET / POST | `/admin/admins`                                                         | List / appoint admins                        |
| PATCH      | `/admin/admins/{adminId}/permissions` · POST `/deactivate`              | Manage admins                                |
| GET / POST | `/admin/holidays`                                                       | List / add a public holiday                  |
| PUT        | `/admin/holidays/{date}`                                                | Edit a holiday's description                 |
| DELETE     | `/admin/holidays/{date}`                                                | Remove a holiday                             |

Holidays feed the ML pricing model (`publicHoliday` is one of its features) and
are otherwise synced automatically each month. The endpoints exist and are
ADMIN-guarded, but **no admin screen calls them** — they are API-only today.

## Media

| Method | Path                            | Auth           | Purpose                           |
| ------ | ------------------------------- | -------------- | --------------------------------- |
| POST   | `/media/upload`                 | any            | Generic image upload (Cloudinary) |
| POST   | `/media/venues/{venueId}/photo` | owner of venue | Upload and attach a venue photo   |
| POST   | `/media/avatar`                 | any            | Upload your avatar                |

Uploads require `CLOUDINARY_URL`. Without it the endpoint fails honestly rather
than returning a URL that does not resolve. Allowed types: JPEG, PNG, WebP.

## AI assistant

| Method | Path                           | Auth   | Purpose                         |
| ------ | ------------------------------ | ------ | ------------------------------- |
| POST   | `/api/ai/chat`                 | public | Chat with the booking assistant |
| DELETE | `/api/ai/sessions/{sessionId}` | any    | Clear a conversation            |
| GET    | `/api/ai/metrics`              | ADMIN+ | Usage metrics                   |

Requires `OPENROUTER_API_KEY`; without it a fallback provider answers.

## System

| Method | Path                                | Auth   | Purpose                     |
| ------ | ----------------------------------- | ------ | --------------------------- |
| GET    | `/health`, `/actuator/health`       | public | Readiness                   |
| GET    | `/api/v1`                           | public | API index                   |
| GET    | `/v3/api-docs/**`, `/swagger-ui/**` | ADMIN+ | OpenAPI spec and Swagger UI |
