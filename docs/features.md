# TurfChai — Feature Inventory

Every feature listed here exists in the final codebase. Features removed during
the audit are listed at the bottom so old documents do not mislead.

Legend: **Implemented** = works end to end, frontend → API → database.

---

# Player features

## Venue discovery and search

**Purpose** — find a pitch to play on.
**Roles** — everyone, including signed-out visitors.
**Frontend** — `pages/player/ExplorePage.jsx`, `HomePage.jsx`, `VenuePage.jsx`
**Backend** — `VenueRestController`, `VenueSearchService`
**Database** — `venues`, `pitches`, `sports`, `sport_pricing_rules`
**API** — `GET /venues`, `GET /venues/{slug}`

Browse a paged catalogue with map (Leaflet) or list view. Filter by area,
sport, amenities, price and time; sort by rating, name, newest or distance
(distance is computed with the haversine formula and re-sorted in memory).
The venue page shows pitches, amenities, house rules, cancellation policy,
opening hours, published reviews and live availability.

**Business rules** — page size is capped at 50. Only `LIVE`/`PUBLISHED` venues
appear publicly.
**Security** — public read; no identifying data is returned.

## Availability and slot holding

**Purpose** — stop two players buying the same hour.
**Frontend** — `pages/player/VenuePage.jsx` (slot grid), `CheckoutPage.jsx`
**Backend** — `SlotRestController`, `BookingService.holdSlot`,
`SlotHoldCleanupJob`, `SlotEventBroadcaster`
**Database** — `slots`
**API** — `GET /venues/{venueId}/slots`, `GET /venues/{venueId}/slots/stream`,
`POST /bookings/hold-slot`

Picking a slot takes a **5-minute exclusive hold**. The row is read with
`PESSIMISTIC_WRITE`, so concurrent attempts serialise on the database. A hold is
re-entrant for its own owner (a duplicate React effect or a retry refreshes the
window instead of failing). `SlotHoldCleanupJob` releases expired holds every
30 seconds. Other viewers see the change immediately over SSE.

**Business rules** — a slot whose start time has passed cannot be held.
A venue that is `OFFLINE`/`SUSPENDED` refuses holds.
**Errors** — `SlotUnavailableException` → 409.

## Booking and checkout

**Purpose** — turn a hold into a confirmed booking.
**Frontend** — `pages/player/CheckoutPage.jsx`, `BookingSuccessPage.jsx`
**Backend** — `PaymentRestController`, `PaymentService.pay`,
`BookingService.createPendingBooking` / `finalizeConfirmedBooking`
**Database** — `bookings`, `payments`, `slots`, `point_ledger_entries`,
`wallet_transactions`
**API** — `POST /payments/checkout`

One transaction does everything: create the pending booking, price and take any
promo discount, apply wallet credit, write a `payments` row per tender, flip the
slot to `BOOKED`, confirm the booking, and award points. If any step fails,
nothing is written.

**Business rules**

- The discount is priced **server-side from the slot price**; the client sends a
  code, never an amount.
- Wallet credit is applied first, capped at the balance and at the amount due.
- A free slot earns no points (a zero award used to roll the whole checkout back).
- The cancellation policy in force is snapshotted onto the booking.

**Security** — the payer is the token holder; the hold must be theirs and unexpired.
**Example** — a ৳2,000 slot with `SAVE25` (25%, capped ৳400) is charged ৳1,600,
and the ledger shows ৳1,600.

## Booking management, cancellation and refund

**Purpose** — see and undo bookings.
**Frontend** — `pages/player/BookingsPage.jsx`, `BookingDetailPage.jsx`,
`CancelPage.jsx`, `MatchdayPage.jsx`
**Backend** — `BookingRestController`, `PaymentService.cancelAndRefund`,
`RefundCalculatorService`
**Database** — `bookings`, `payments`
**API** — `GET /bookings`, `GET /bookings/{id}`,
`GET /payments/refund-preview/{id}`, `POST /payments/cancel/{id}`

Bookings are grouped into upcoming, pending payment, completed and cancelled.
The detail page shows the venue, pitch, match time, a QR match-day ticket, the
payment timeline and a payment summary (slot price, paid, refunded, and either
_still due_, _settled_ or _net charged_).

Cancelling always goes through the confirmation screen, which shows the refund
percentage and amount **before** anything is cancelled.

**Business rules**

- The refund tier comes from the policy snapshotted on the booking.
- Refunds are split by tender — gateway money to the gateway, wallet credit to
  the wallet.
- Cancelling releases the slot only if no other live booking holds it.
- Cancelling returns any promo redemption and claws back the points awarded.
- A booking cannot be cancelled twice.

**Security** — a booking that is not yours answers 404, not 403, so ids cannot
be enumerated.

## Reviews

**Purpose** — let the next team book with confidence.
**Frontend** — `pages/player/ReviewPage.jsx`; read on `VenuePage.jsx`
**Backend** — `ReviewRestController`, `ReviewService`,
`VenueReviewRestController`
**Database** — `reviews`, `venues.rating_avg`, `venues.review_count`
**API** — `POST /reviews`, `GET /venues/{slug}/reviews`

An overall 1–5 rating plus optional per-category ratings and a comment. On
submission the venue's stored rating and review count are recomputed, so every
surface that quotes a rating agrees.

**Business rules**

- Only the booking's own player may review it.
- The match must have started; a future booking is refused with
  _"You can review this booking once the match has started"_.
- A cancelled booking cannot be reviewed.
- One review per `(booking, user)` — enforced by a unique database constraint.
- The venue is taken from the booking, so a review cannot be attached to an
  unrelated venue's rating.

## Rewards, tiers and wallet

**Purpose** — reward repeat play.
**Frontend** — `pages/player/RewardsPage.jsx`, `dashboard/WalletStatsSections.jsx`
**Backend** — `RewardRestController`, `RewardService`
**Database** — `point_ledger_entries`, `loyalty_tiers`, `reward_products`,
`reward_redemptions`, `wallet_transactions`
**API** — `GET /rewards/my-points|activity|wallet|products|tiers`,
`POST /rewards/redeem`

Points are earned on paid bookings, with an off-peak bonus where applicable, and
reversed when a booking is cancelled. Points buy rewards from a catalogue;
wallet credit can be spent at checkout.

## Saved venues

**Frontend** — `pages/player/dashboard/SavedVenuesSection.jsx`
**API** — `GET/POST/DELETE /players/me/saved-venues[/{slug}]`
**Database** — `saved_venues`, `venues.saved_count`

## Notifications

**Purpose** — tell players what happened to their bookings.
**Frontend** — bell + drawer in `layouts/PlayerLayout.jsx`,
`dashboard/PendingSections.jsx`
**Backend** — `NotificationRestController`, `NotificationService`, and the
services that perform each transition
**Database** — `notifications`
**API** — `GET /notifications`, `/unread-count`, `POST /{id}/read`, `/read-all`

Notifications are written by the service that performs the state change, inside
its transaction — never fabricated in the frontend:

| Event                 | Type                    | Written by                                                                  |
| --------------------- | ----------------------- | --------------------------------------------------------------------------- |
| Booking confirmed     | `BOOKING_CONFIRMED`     | `BookingService.finalizeConfirmedBooking` / `approveBooking`                |
| Booking cancelled     | `BOOKING_CANCELLED`     | `BookingService.cancelBooking` (says so when the venue cancelled it)        |
| Refund issued         | `REFUND_ISSUED`         | `PaymentService.cancelAndRefund`, only when money moved                     |
| Checkout failed       | `PAYMENT_FAILED`        | `PaymentService.pay`, in a separate transaction so it survives the rollback |
| Match starting soon   | `BOOKING_REMINDER`      | `BookingReminderJob`, hourly, 24 h ahead                                    |
| Tournament registered | `TOURNAMENT_REGISTERED` | `TournamentService.register`                                                |
| Entry fee recorded    | `TOURNAMENT_UPDATE`     | `TournamentService.markEntryFeePaid`                                        |

Opening one marks it read and navigates to its subject. Deduplicated on
`(userId, type, link)`. The feed never exposes `userId`.

## Solo / open games

**Purpose** — play when you do not have a full team.
**Frontend** — `solo/OpenGamesPage.jsx`, `GameDetailPage.jsx`,
`CreateGameDrawer.jsx`, `TicketPage.jsx`, `LfgAlertPage.jsx`
**Backend** — `OpenGameRestController`, `OpenGameServiceImpl`,
`TicketRestController`, `LfgAlertRestController`
**Database** — `open_games`, `open_game_memberships`, `lfg_alerts`
**API** — `/solo/open-games/**`, `/solo/tickets/**`, `/solo/lfg-alerts/**`

Post a game (the organiser takes the first spot automatically), browse the feed
with server-side filters, and claim a spot. Standing LFG alerts watch for
matching games.

**Business rules** — capacity is enforced under a row lock and the game flips to
`FULL`; a player cannot join twice; a reliability bar below the player's score
refuses them with the reason; `minimumReliability` is bounded 0–100.

## Tournaments (player side)

**Frontend** — `pages/player/TournamentDetailPage.jsx`,
`TournamentRegisterPage.jsx`, `dashboard/TournamentsSection.jsx`
**Backend** — `PlayerTournamentRestController`, `TournamentService`
**Database** — `tournaments`, `tournament_teams`
**API** — `GET /tournaments`, `/tournaments/me`, `/{code}`,
`POST/DELETE /{code}/register`

Register a team; the entry fee is recorded as **DUE** — nothing pretends a
payment happened. One entry per player per tournament. Withdrawal is allowed
while the fee is unpaid.

## Profile and settings

**Frontend** — `pages/player/ProfileSettingsPage.jsx`, `OnboardingPage.jsx`
**API** — `GET/PATCH /players/me`, `GET /players/me/stats`

Name, area, bio, play style, player role, preferred sports and times. Email is
read-only. Statistics (bookings, check-ins, venues played, reliability, spend,
favourite venue, monthly counts) are measured from real rows.

---

# Owner features

## Dashboard

**Frontend** — `pages/owner/DashboardPage.jsx`
**Backend** — `OwnerAnalyticsRestController`, `OwnerAnalyticsService`
**API** — `GET /owner/analytics/dashboard`

Today's revenue, bookings today, occupancy, pending payments, what is next on
the pitches, recent activity, items needing attention, and a last-7-days block
with week-on-week change and booking-source split.

**Business rules** — "today" means the booking's **play date**, not its sale
date. Occupancy is booked-or-held slots over slots published for today; with no
slots published it reports "—" rather than a fabricated percentage.

## Venue setup

**Frontend** — `pages/owner/VenueSetupPage.jsx`
**Backend** — `OwnerVenueRestController`, `VenueManagementService`
**API** — `/owner/venues/**`

Identity and location (with a map picker), photos, opening hours, amenities and
house rules, deposit and cancellation policy, pitches, sport pricing rules, slot
generation, and publish/offline. A completeness bar is computed from what has
actually been filled in.

## Calendar and bookings

**Frontend** — `pages/owner/CalendarPage.jsx`, `BookingsPage.jsx`
**API** — `GET /owner/venues/{id}/calendar`, `/owner/bookings`,
`POST /owner/bookings/{id}/approve|cancel|refund`,
`POST /owner/venues/{id}/slots/{slotId}/block|unblock`,
`POST /owner/venues/{id}/manual-booking`

A pitch × time grid, manual (walk-in/phone) bookings, slot blocking for
maintenance, per-slot price override, and approve/cancel/refund on a booking.
Cancelling or refunding notifies the player.

## Check-in

**Frontend** — QR scanner panel on the owner dashboard
**API** — `POST /matchday/checkin`

Scanning or typing a booking reference records a real check-in against the
booking. An unknown reference is refused by name.

## Customers

**Frontend** — `pages/owner/CustomersPage.jsx`
**API** — `GET /owner/customers`

Derived entirely from real bookings: visits, spend, last visit, standing,
no-shows. "Last visit" counts only matches that have actually been played.

## Promotions

**Frontend** — `pages/owner/PromotionsPage.jsx`
**API** — `/owner/venues/{venueId}/promotions/**`

Percentage or flat codes with a minimum order, a maximum discount, a validity
window and a usage limit. Pausing takes a code out of use immediately.

## Payments and reports

**Frontend** — `pages/owner/PaymentsPage.jsx`
**API** — `GET /owner/payments`

Gross, platform fees (**6%**), refunds, net, a reconciliation block, method
split, per-sport report and the booking ledger. Periods are closed at both ends,
so "this week" cannot sweep in future-dated sales.

## Reviews

**Frontend** — `pages/owner/ReviewsPage.jsx`
**API** — `GET /owner/reviews`, `POST /owner/reviews/{id}/response`

Every review across the owner's venues with a star breakdown and category
averages. Publishing a reply shows it under the review on the public venue page.
A review belonging to another owner's venue answers _not found_, so review ids
cannot be probed.

## Venue verification

**Frontend** — `pages/owner/OwnerOnboardingPage.jsx`
**API** — `POST /turf-requests`, `/turf-requests/upload`

A multi-step submission (venue, location, documents, review). Document **names**
are recorded — TurfChai has no document store, and the UI says so rather than
claiming files were filed.

---

# Tournament host features

**Frontend** — `host/TournamentPage.jsx`, `MultiPitchPage.jsx`, `ReservePage.jsx`
**Backend** — `TournamentRestController`, `TournamentService`
**Database** — `tournaments`, `tournament_teams`, `tournament_fixtures`,
`tournament_pitch_reservations`
**API** — `/host/tournaments/**`

Create a tournament (format, capacity, entry fee, prize pool, privacy); reserve
slots across several pitches with conflict checking and optional weekly
recurrence; pay a **server-priced** deposit and later the balance; add teams and
mark entry fees paid; rotate the invite link; and generate the knockout bracket.

**Business rules** — every amount is computed server-side, so a client cannot
name its own price. A multi-pitch bundle discount applies from 12 slots. Marking
a fee paid notifies the registering player.

---

# Admin features

**Frontend** — `pages/admin/*`
**Backend** — `AdminController`, `AdminAnalyticsRestController`,
`AdminUserRestController`, `AdminVenueRestController`,
`AdminTurfRequestRestController`, `AdminPayoutRestController`,
`AdminAuditLogRestController`, `AdminAuthController`

| Area                   | What it does                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Two-factor login       | Password, then a one-time code; single-use, TTL-bound, 5 challenges per 15 min                                                      |
| Platform overview      | GMV, bookings, commission actually collected on settled payouts, AOV, growth, user segments, live audit feed                        |
| User growth / segments | Registrations over time, acquisition channels from the real `signup_channel`, tiers, cohorts, regional split (labelled as a sample) |
| Users                  | Paged roster with role/status/search, suspend and reinstate, CSV export of the filtered roster                                      |
| Venues                 | Moderation list, per-venue 30-day analytics, approve/suspend/archive                                                                |
| Turf requests          | Verification queue with approve / reject / request-changes                                                                          |
| Payouts                | Ledger, per-payout detail, settle and flag — both notify the owner                                                                  |
| Admins                 | Appoint, change permissions, deactivate                                                                                             |
| Activity               | Paged audit trail, CSV export                                                                                                       |
| Profile                | Account details, logged-action count taken from the audit trail                                                                     |

---

# System features

| Feature                | Where                                               | Notes                                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamic pricing        | `pricing/PricingInferenceService`                   | ONNX model over 9 features: day, month, hour, weekend, public holiday, days before booking, weather condition, occupancy rate, time slot. Answers 503 when the model is unavailable rather than inventing a price |
| Weather + holiday sync | `DailyWeatherSyncScheduler`, `HolidaySyncScheduler` | Feed pricing features #7 and #5 from Open-Meteo and date.nager.at                                                                                                                                                 |
| Live slot stream       | `SlotEventBroadcaster`                              | SSE, published after commit                                                                                                                                                                                       |
| AI booking assistant   | `ai/` module                                        | OpenRouter LLM with RAG over `resources/ai-knowledge` and six database-backed tools; falls back cleanly without a key                                                                                             |
| Media upload           | `media/`                                            | Cloudinary; fails honestly when unconfigured                                                                                                                                                                      |
| Audit logging          | `AuditLog`                                          | Records admin actions                                                                                                                                                                                             |

---

# Removed during the audit — do not document as active

| Removed                                                | Why                                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Team split payment (page + owner toggle)               | No collection, reminders or per-player shares exist                                     |
| Player "Teams" and "Player network" dashboard sections | Advertised unbuilt software; tournament squads and open games already serve those needs |
| Owner "Staff & shifts"                                 | No backend                                                                              |
| Admin holiday CRUD API                                 | No UI; the monthly sync scheduler already maintains the data                            |
| `PUT /owner/venues/{id}/ml-settings`                   | Set a flag the pricing service never reads                                              |
| `BankAccount` entity + repository                      | No payout destination is used; TurfChai settles at the venue                            |
