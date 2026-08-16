# TurfChai — Engineering Decisions, Limitations and Roadmap

---

# Part 1 — Decisions

## Payments are recorded, not collected

**Problem** — a capstone cannot onboard a real bKash/Nagad merchant account.

**Decision** — model the full money lifecycle (booking price, promo discount,
wallet credit, per-tender payment rows, refunds by tender, platform fee, owner
payouts) but do **not** integrate a payment gateway. The chosen method is
recorded; the money settles at the venue.

**Why** — the interesting engineering is the ledger, the concurrency and the
refund arithmetic, none of which need a real gateway. Faking a gateway would
have made every downstream number untrustworthy.

**Trade-off** — the product cannot actually take money online.

**Implementation** — `PaymentMethod` is `BKASH|NAGAD|CARD|CASH`;
`CheckoutRequest` has no card, account, PIN or OTP field, because none is
transmitted. `provider` is stored as `mock-<method>`. The UI states the amount
is payable to the venue. **This is never described as a gateway integration.**

## Pessimistic locking rather than optimistic retries

**Problem** — two players clicking the same slot at the same moment; a promo
code with three uses being redeemed twelve times at once.

**Decision** — take a `PESSIMISTIC_WRITE` row lock on the contended row for the
whole transaction.

**Why** — the contended rows are few and hot. Optimistic locking would surface
as retry storms and would still need a lock to make the compound
booking + payment + points transaction atomic.

**Trade-off** — serialises access to popular slots; would need revisiting at
much higher volume.

**Implementation** — `SlotRepository.findByIdForUpdate`,
`PromotionRepository.findByVenueAndCodeForUpdate`,
`OpenGameRepository.findWithLockById`. Proven by
`BookingConcurrencyIntegrationTest` and the 12-way promotion race test.

## Hold-then-pay instead of book-then-pay

**Problem** — a player filling in checkout should not lose the slot, but an
abandoned checkout must not block it forever.

**Decision** — a 5-minute exclusive hold, re-entrant for its owner, swept by a
scheduled job.

**Why** — it gives the player a guarantee without permanently removing
inventory.

**Implementation** — `BookingService.holdSlot` + `SlotHoldCleanupJob` (every
30 s). Re-entrancy matters in practice: React StrictMode double-invokes effects
in development, and a retried request must not 409.

## The acting user always comes from the token

**Problem** — the original implementation read `userId` from request bodies, so
a caller could write a review as somebody else.

**Decision** — controllers resolve `UserPrincipal` and pass its id down;
body-supplied identity is ignored.

**Implementation** — `AuthenticatedUser.requireId(principal)` throughout.
`ReviewDto.userId` is retained but `@Deprecated` and unused so older clients do
not break. `JoinOpenGameRequest.userId` was removed entirely, because a
_required_ field the server must ignore had made every join fail validation.

## Missing resource and forbidden resource look identical

**Decision** — reading a booking you do not own returns 404, not 403.

**Why** — distinguishable statuses make the id space enumerable. The same
applies to replying to a review on another owner's venue.

## Stored aggregates for venue reputation

**Problem** — the rating appears on search results, the venue page, the owner
console and admin moderation. Computing it per surface invites disagreement.

**Decision** — store `rating_avg` and `review_count` on `venues` and recompute
them in one place when a review is written.

**Trade-off** — a write-time cost and a single place that must not be bypassed.

**Implementation** — `ReviewService.recalculateVenueRating`. The consistency
audit asserts the stored value equals the mean of the venue's published reviews.

## Cancellation policy snapshotted at confirmation

**Problem** — an owner changing the policy would silently change the refund owed
on bookings already sold.

**Decision** — copy the policy onto the booking when it is confirmed and refund
from the copy.

**Implementation** — `Booking.cancelPolicySnapshot`.

## Notifications originate from the transition, in its transaction

**Problem** — a notification written by the frontend, or after the fact, can
describe something that did not happen.

**Decision** — the service that changes the state writes the notification, in
the same transaction. Deduplicate on `(userId, type, link)`.

**Exception** — telling a player a checkout _failed_ must survive that
transaction's rollback, so it is written with `Propagation.REQUIRES_NEW`.

## No global state library on the frontend

**Decision** — React state, four small contexts, one fetch wrapper and one
`useApi` hook. No Redux, Zustand or React Query.

**Why** — the app is screen-oriented; almost all state is server state fetched
per screen. A cache library would have added a second source of truth.

**Trade-off** — some refetching that a cache would avoid.

## Honesty enforced by tooling

**Problem** — the fastest way to make a UI look finished is a success toast.

**Decision** — make dishonesty fail the build. `scan-honesty.mjs` is a gate
stage that fails when a `catch` swallows an error and reports success;
exemptions must be listed with a reason. A control that cannot work is
`disabled` with a `title` explaining why.

**Result** — 0 toast-only handlers; 12 honestly-disabled controls.

## Two package styles in the backend

**Context** — the backend has both feature packages (`booking`, `payment`,
`venue`, …) and older layer packages (`controller`, `service`, `repository`).

**Decision** — leave the older classes where they are rather than move them.

**Why** — a large rename would have produced a huge diff with no behavioural
benefit and would have obscured the audit history.

**Trade-off** — a newcomer must check two places. Documented in
[architecture.md](architecture.md#package-layout).

## Historical migrations are never edited

**Decision** — where a feature was dropped, its columns stay.

**Why** — Flyway validates checksums; editing an applied migration breaks every
existing database.

**Consequence** — `bank_accounts`, `allow_split_payment`, `split_enabled` and
`booking_members` still exist in the schema although nothing reads them.

---

# Part 2 — Known limitations

Stated plainly. Nothing here is presented as working.

### Not implemented

| Area                                   | Status                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Real payment gateway                   | **Not implemented.** Payments are recorded; money settles at the venue                           |
| Team split payment                     | **Not implemented** and removed from the UI. No per-player shares, reminders or collection       |
| Document storage                       | **Not implemented.** Venue verification records document _names_; files are not stored           |
| Teams / squads, player network         | **Not implemented.** Removed from the dashboard; tournament squads and open games cover the need |
| Self-service password change / reset   | **Not implemented.** No endpoint exists; the UI says so                                          |
| Server-side session revocation         | **Not implemented.** Tokens are stateless JWTs; sign-out clears the client only                  |
| Booking reschedule                     | **Not implemented.** Cancel and rebook                                                           |
| Customer notes                         | **Not implemented.** The control is disabled with an explanation                                 |
| In-app messaging                       | **Not implemented.** Host and venue contact use the real phone number                            |
| Tournament cancellation (self-service) | **Not implemented.** Handled by support                                                          |
| Emailed / SMS receipts                 | **Not implemented**                                                                              |
| Admin holiday management UI            | **Not implemented.** Holidays are synced automatically each month                                |

### Partially implemented

| Area                                    | Detail                                                                                                                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email delivery                          | Wired through `JavaMailSender`, but skipped entirely when `SPRING_MAIL_HOST` is unset — which is the default. Admin codes are then available as `devCode` in the response (dev/demo only) |
| Image upload                            | Real Cloudinary integration, but inert without `CLOUDINARY_URL`; uploads then fail rather than returning a URL                                                                            |
| AI assistant                            | Real RAG + tool-calling module, but needs `OPENROUTER_API_KEY`; without it a fallback provider answers                                                                                    |
| ML dynamic pricing                      | Real ONNX model with 9 features; returns 503 when the model cannot be loaded. Booking is unaffected — slots carry a stored price                                                          |
| `HOST` role                             | Exists as a role value, but the tournament workspace is reachable by any authenticated user. Hosting is not role-gated today                                                              |
| `mlPricingEnabled`, `allowSplitPayment` | Persisted on the venue but read by nothing                                                                                                                                                |

### Operational limitations

- The `dev`/`test` profiles rebuild H2 on every restart, so ids are not stable
  between runs.
- The browser QA probes run against the **production preview** (`4173`, and
  `4175` for accessibility), not the dev server on `5173`. Started without it
  they fail with `ERR_CONNECTION_REFUSED` on every route, which reads like a
  hung crawler rather than a missing server.
- **Seeded demo venues are owned by the demo _player_ account.**
  `VenueDataSeeder` assigns `PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID` — a
  `PLAYER`-role user — as the owner of its venues, so `/owner/**` returns 403
  for them and their owner console cannot be opened. Venues created through
  owner onboarding, and those seeded by `AdminDemoDataSeeder`, are unaffected.
  This is dev/demo seed data only; no production path assigns a venue to a
  non-owner.
- `frontend/qa/review-flow.mjs` reads `/owner/reviews` without checking the HTTP
  status, so a 403 is reported as "0 reviews" rather than as a refusal.
- `OTP_EXPOSE_DEV_CODE=true` returns admin one-time codes in the API response.
  It is a demo convenience and **must be false in production**.

---

# Part 3 — Roadmap

### P0 — before any real deployment

1. Integrate a real payment gateway (bKash/Nagad/SSLCOMMERZ) behind the existing
   `PaymentService` boundary; the ledger and refund engine already model it.
2. Set `OTP_EXPOSE_DEV_CODE=false` and configure SMTP so admin codes are
   delivered out of band.
3. Configure `CLOUDINARY_URL` so venue photos and documents actually persist.
4. Rotate `JWT_SECRET` and move all secrets to the platform's secret store.

### P1 — high value

1. Gate the tournament workspace on the `HOST` role, or drop the role.
2. Password change and reset.
3. Document storage for venue verification, so the admin reviews real files.
4. Refresh-token rotation in the frontend, so sessions survive expiry without a
   re-login.
5. Give the seeded demo venues a genuine `OWNER`-role owner, so the owner
   console can be opened against seed data, and make `review-flow.mjs` assert
   the HTTP status so a refusal is never reported as an empty list.

### P2 — enhancements

1. Owner payout scheduling rather than admin-initiated settlement only.
2. Richer tournament formats (league, groups) alongside knockout.
3. Player-to-player invitations built on the existing open-game roster.
4. Push/web notifications on top of the existing notification store.
5. Read the `mlPricingEnabled` flag in the pricing path, or remove the column.

### P3 — long term

1. Multi-city expansion (the schema already carries area and coordinates).
2. Retrain the pricing model on real booking data.
3. Native mobile clients against the existing API.
