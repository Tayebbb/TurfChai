# TurfChai — QA Reproduction Baseline

**Status:** baseline established, findings reproduced, **no application source modified**
**Commit under test:** `5cbbd744fd1c2cebe7421ae42029c0f5a9fee8ca` (`main`, == `origin/main`)
**Working tree at capture:** clean (only the new `qa/` tooling directory is added)
**Captured:** 2026-08-15, Asia/Dhaka

---

## 1. Environment Baseline

| Item | Value |
|---|---|
| Backend | Spring Boot 4.1.0 / Java 25, `mvnw spring-boot:run -Dspring-boot.run.profiles=dev` on `:8080` |
| Frontend | Vite 7 / React 19, `npm run dev` on `:5173` |
| Database | **In-memory H2** (`jdbc:h2:mem:turfchai;MODE=PostgreSQL`), `ddl-auto=update` |
| Migrations | **Flyway is DISABLED in `dev`** (`spring.flyway.enabled=false`) — V1–V27 are never executed locally |
| Seeders | `@Profile({"dev","test"})` CommandLineRunners + two unprofiled seeders |
| Backend tests | `mvnw -o test` → **300/300 pass, BUILD SUCCESS**, 0 skipped, 47 test classes |
| Frontend lint | `npx eslint .` → **0 errors, 0 warnings** |
| Frontend build | `npm run build` → **success**, ~5s |
| Frontend tests | **NONE.** `package.json` has no `test` script, no runner and no test dependency |
| E2E tests | **NONE** |

### Isolation strategy
The project already ships an isolated development profile (`dev`) backed by an **in-memory** H2
database. Restarting the backend therefore yields a guaranteed-clean database with no risk to any
developer's data. All QA data is created through the project's own public REST API by
`qa/seed-qa-dataset.ps1`; **no application source, configuration or migration was modified.**

### Environment caveats that affect confidence
1. **Flyway never runs in `dev`.** The schema under test is Hibernate's `ddl-auto=update` output, not
   the migration chain. Anything that only fails on PostgreSQL + Flyway is invisible here.
2. **`AdminPartBDataSeeder` never executes** (see `QA-N01`), so bookings/payouts/audit-log demo data
   are absent from every fresh boot.
3. Backend log for this session: `%TEMP%\tc-qa-backend.log`.

---

## 2. Deterministic QA Dataset

Created by `qa/seed-qa-dataset.ps1`; full machine-readable manifest in
`qa/baseline/qa-dataset.json`. Server-generated ids are discovered programmatically and recorded.

### Accounts (password for every QA account: `QaPass@12345`)

| Key | Email | Role | Id | Purpose |
|---|---|---|---|---|
| playerA | `qa.player.a@turfchai.test` | PLAYER | 842 | multiple bookings, saved venues, tournament team, reviewable booking |
| playerB | `qa.player.b@turfchai.test` | PLAYER | 843 | cross-user authorization target |
| playerZero | `qa.player.zero@turfchai.test` | PLAYER | 844 | zero bookings (empty-state testing) |
| ownerA | `qa.owner.a@turfchai.test` | OWNER | 845 | venue, pitch, slots, promotion, bookings, customers |
| ownerB | `qa.owner.b@turfchai.test` | OWNER | 846 | cross-owner isolation target |
| soloPlayer | `qa.solo.a@turfchai.test` | SOLO_PLAYER | 847 | solo/open-game role |

### Pre-existing seeded identities

| Email | Password | Role | Notes |
|---|---|---|---|
| `rafi@turfchai.dev` | `demo1234` | PLAYER | demo player, publicId `11111111-1111-1111-1111-111111111111`, holds 2,740 reward points, **and is the owner of all 10 demo venues** (see `QA-N03`) |
| `fazle.rabbi.mugdho@gmail.com` | `Demo@12345` | SUPER_ADMIN | id 1, 2FA login (`devCode` returned inline in dev) |
| `admin0@turfchai.com` … `admin3@` | `Demo@12345` | ADMIN | id 838+ |
| ~839 generated users | `Demo@12345` | PLAYER/SOLO/HOST/OWNER | `AdminDemoDataSeeder`, deterministic `Random(42)` |

### Entities

| Entity | Detail |
|---|---|
| Venues | 50 (10 rich demo venues + 40 generated) + 2 auto-provisioned owner venues = 52 |
| ownerA venue | id **51**, `kick-off-arena-2`, status **DRAFT**, pitch id **115** (`QA Pitch 1`), pricing rule id 21 |
| ownerB venue | id **52**, `kick-off-arena-3` |
| Owner slots | **12** generated on pitch 115 (today+tomorrow, 08:00–20:00, 120 min, ৳1800) |
| Blocked slot | id **132** (18:00) — `BLOCKED` state |
| Bookings | 6 seeded: id 1 past/completed, 2 upcoming, 3 cancelled, 4 paid-via-checkout, 5 playerB, 6 at ownerA venue |
| Payments | 1 × `SUCCESS` BKASH ৳2000 (`PAY-…`), + CARD ৳1800 during probes |
| Tournament | `TR-CUP-0091` — 13 seeded teams **PAID** + QA team id 14 **DUE**, fixtures/bracket generated, capacity 16 |
| Open game | id **1**, `OG-…`, capacity 10, roster grew 842 → 843 → 847 → 848 during probes |
| Rewards | demo player 2,740 pts (GOLD); redemption id 1 (৳50 credit, 500 pts) → wallet ৳50, balance 2,240 |
| Saved venues | playerA ← `kick-off-arena`, `gulshan-turf-park` |
| Promotion | `QA20`, PERCENT 20, venue 51 |

> **Dataset note:** `playerA`'s display name reads `Role Esc` and `playerB`'s reads `TC001 TAMPERED`
> because the `QA-N08` and `TC-001` probes deliberately renamed them. This is expected and is itself
> evidence for `TC-001`.

---

## 3. Reproduction Results

Machine-readable: `qa/baseline/qa-findings-api.json`, `qa-findings-followup.json`,
`qa-findings-proofs.json`, `qa-join-identity-proof.json`, `qa-dead-controls.json`.

| ID | Finding | Severity | Result |
|---|---|---|---|
| TC-001 | Unauthenticated account access + tampering via `X-User-Id` | Critical | ✅ **REPRODUCED** |
| TC-002 | Unauthenticated tournament manipulation | Critical | ✅ **REPRODUCED (escalated)** |
| TC-003 | Player dashboard bookings crash with real bookings | High | ✅ **REPRODUCED** |
| TC-004 | Admin turf detail crash | High | ✅ **REPRODUCED (all ids)** |
| TC-005 | Review submission 500 while persisting | High | ✅ **REPRODUCED (escalated)** |
| TC-006 | Match-day check-in ownership bypass | High | ✅ **REPRODUCED (escalated)** |
| TC-007 | Review authorship bypass | High | ✅ **REPRODUCED (upgraded from code-only)** |
| TC-008 | Signed-out identity leakage | High | ✅ **REPRODUCED** |
| TC-009 | Past slots bookable | High | ✅ **REPRODUCED (escalated)** |
| TC-010 | Simulated payment presented as real | High | ✅ **REPRODUCED (contract-level proof)** |
| TC-011 | 37 toast-only dead controls | High | ✅ **REPRODUCED — independently re-scanned, count is exactly 37** |

### TC-001 — Unauthenticated account takeover
`SecurityConfig` marks `/api/v1/players/**` `permitAll`; `UserProfileRestController.currentUserId()`
falls back to the `X-User-Id` header, then to a hardcoded demo UUID.

| Request (no `Authorization` header) | Expected | Actual |
|---|---|---|
| `GET /api/v1/players/me` + `X-User-Id: <playerB publicId>` | 401 | **200** — returns `qa.player.b@turfchai.test`, phone `+8801900000002` |
| `PATCH /api/v1/players/me` + same header | 401 | **200** — `fullName` overwritten to `TC001 TAMPERED`, bio and area overwritten |
| `GET /api/v1/players/me/saved-venues` | 401 | **200** |
| `POST /api/v1/players/me/saved-venues/mirpur-sports-city` | 401 | **200** `{"saved":true}` |
| `DELETE /api/v1/players/me/saved-venues/mirpur-sports-city` | 401 | **204** |
| `GET /api/v1/players/me` **with no header at all** | 401 | **200** — returns the demo user `rafi@turfchai.dev` |

**Impact:** PII disclosure (email + phone) and unauthenticated write access to any account whose
`publicId` is known. `publicId` is returned by the login response and is sent by the frontend as the
`X-User-Id` header on every request.

### TC-002 — Unauthenticated tournament manipulation *(escalated)*
All of the following succeed **without any token**:

| Request | Identity used | Actual |
|---|---|---|
| `GET /api/v1/host/tournaments/TR-CUP-0091` | none | **200** full tournament |
| `POST /api/v1/tournaments/TR-CUP-0091/register` | `X-User-Id` header | **201** team `TC002 Ghost FC`, code `REG-16L1KQ` |
| `DELETE /api/v1/tournaments/TR-CUP-0091/register` | `X-User-Id` header | **204** registration withdrawn |
| `POST /api/v1/host/tournaments/TR-CUP-0091/teams/1/entry-fee` | **none at all** | **200** — marked ৳3,500 as `PAID` |
| `POST /api/v1/host/tournaments/TR-CUP-0091/fixtures/generate` | **none at all** | **200** — entire bracket regenerated |
| `POST /api/v1/host/tournaments` | `X-User-Id` header | **201** — new tournament `TR-CUP-0030` created |

> **Escalation vs. the previous audit:** tournament *creation* was previously recorded as `400`. That
> was a payload error — `CreateTournamentRequest` requires **lowercase** `format`
> (`5_a_side|6_a_side|7_a_side|knockout`) and `privacy` (`open|invite_only`). With the correct casing
> an anonymous caller successfully creates tournaments.

### TC-003 — `/player/dashboard/bookings` crash
- **Precondition:** playerA has 5 bookings (`GET /api/v1/bookings` → 5).
- **Actual:** ErrorBoundary — *"This page didn't load"*.
- **Stack:** `TypeError: paths.player.booking is not a function` at
  `frontend/src/pages/player/dashboard/PendingSections.jsx:55` inside `BookingsSection` (`Array.map`).
- **Source cause:** `PendingSections.jsx:41` calls `paths.player.booking(...)`; `routes/paths.js`
  defines `bookings`, `bookingDetail`, `bookingSuccess` — there is no `booking`.
- **Control:** `/player/bookings` renders the same data correctly — *Upcoming (2), Pending payment (0),
  Completed (2), Cancelled (1)*.
- **Why it was missed:** with zero bookings the `.map` body never executes.

### TC-004 — `/admin/turfs/:id` crash
Reproduced as SUPER_ADMIN against **every** id tried:

| Route | Result |
|---|---|
| `/admin/turfs/1` (real demo venue) | **CRASH** |
| `/admin/turfs/51` (real QA owner venue) | **CRASH** |
| `/admin/turfs/99999` (nonexistent) | **CRASH** |
| `/admin/turfs` (list, control) | renders — 52 venues |

`TypeError: Cannot read properties of undefined (reading 'toLocaleString')` in `TurfDetailsPage`.
Source: `frontend/src/pages/admin/TurfDetailsPage.jsx:323` → `venue.bookings30d.toLocaleString()`.
The pre-data fallback object returned by the `useMemo` omits `bookings30d`, so the **first** render
always throws — before any API response arrives. The page is unreachable by design, not by data.

### TC-005 — Review 500 with silent persistence *(escalated)*
| Step | Result |
|---|---|
| `POST /api/v1/reviews` (playerA, own booking) | **500** |
| Repeat the identical request | **400** — *"Review already exists for this booking and user"* |

**Server stack:** `HttpMessageNotWritableException: Could not write JSON: Could not initialize proxy
[com.turfchai.booking.entity.Slot#7] - no session`. `ReviewRestController` returns the raw JPA
`Review` entity; `Review → Booking → Slot` is lazy and `open-in-view=false`, so serialization happens
after the transaction (and session) closed. **The row commits, then the response fails.**

**New evidence — data corruption:** `ReviewService.recalculateVenueRating()` also commits, overwriting
the venue's public reputation from requests that all reported failure:

| Venue | Seeded | After 4 failing POSTs |
|---|---|---|
| `kick-off-arena` | 4.8 / 214 reviews | **3.33 / 3 reviews** |
| `mirpur-sports-city` | 4.7 / 301 reviews | **1.00 / 1 review** |

### TC-006 — Match-day check-in ownership bypass *(escalated)*
| Call | Expected | Actual |
|---|---|---|
| playerB checks in **playerA's** booking 1 | 403 | **200** `"Checked in successfully"` |
| playerA checks in **playerB's** booking 5 | 403 | **200** |
| playerA checks in booking `999999` | 404 | 400 |
| playerA checks in his own **CANCELLED** booking 3 | 409/400 | **200** ← *new* |

`ReviewService.checkIn(Long bookingId)` loads the booking by id and stamps `checkedInAt`; there is no
caller comparison and no status guard.

### TC-007 — Review authorship bypass *(upgraded to fully reproduced)*
Authenticated as **playerB**, posting `userId = playerA`:
- First attempt → 500 (TC-005 firing on the same path).
- **Re-posting the identical forged payload → 400 "Review already exists for this booking and user."**
  The duplicate guard is keyed on `(bookingId, userId)`, so a row attributed to **playerA** exists.
  The forged review was written.

`ReviewService.submitReview(dto)` uses `dto.getUserId()` verbatim; no principal comparison and no
booking-ownership check.

### TC-008 — Signed-out identity leakage
With `localStorage` cleared and no session:

| Route | Rendered to an anonymous visitor |
|---|---|
| `/player` | *"Salam, Rafiul"*, avatar `RK`, *"Dhanmondi, Dhaka"*, *"100% reliability"* |
| `/player/dashboard/settings` | Full profile form pre-filled with **`rafi@turfchai.dev`**, name, area, skill, preferences |

Root cause is TC-001: `PlayerLayout` calls `getMyProfile()` unconditionally and the `permitAll`
endpoint answers with the demo user.

### TC-009 — Past slots bookable *(escalated)*
Wall clock at test: **22:24**. `GET /api/v1/venues/1/slots?date=<today>` returned **4 AVAILABLE slots
already in the past** (09:30, 16:00, 19:00, 20:30).

| Step | Result |
|---|---|
| `POST /bookings/hold-slot` on the 09:30 slot | **200** |
| `POST /bookings` to confirm | **200** → booking id 7, `CONFIRMED` |
| Seeder booking id 1 | a **07:00** slot booked at 22:20 the same day |
| `GET /venues/1/slots?date=<yesterday>` | **200, 24 rows** |
| `GET /venues/1/slots?date=1999-01-01` | **200, 24 rows** |

The slot endpoint materialises rows on demand for *any* date, so past dates are not merely exposed —
they are generated.

### TC-010 — Simulated payment
`CheckoutRequest` has exactly three fields: `slotId`, `method` (`BKASH|NAGAD|CARD|CASH`),
`applyWalletAmount`. **There is no field for a card number, account number, PIN or OTP**, so the
bKash sheet in the UI transmits nothing. `POST /api/v1/payments/checkout` with `method:"CARD"` and no
credentials returned **200 `status:"SUCCESS"`** with `txnReference: "PAY-22F82B3B"` (locally generated).

| Control | Result |
|---|---|
| checkout without a prior hold | **409** (correctly rejected) |
| `applyWalletAmount = -500` | **400** (validated) |
| `applyWalletAmount = 999999` | 409 (hold already consumed) |

The UI copy — *"Secure payment"*, *"TurfChai never sees your PIN"* — describes a provider integration
that does not exist.

### TC-011 — Dead controls (independent re-scan)
`qa/scan-dead-controls.ps1` scanned **198 files** without reusing the previous result set:

| Category | Count |
|---|---|
| Inline handlers whose entire body is `showToast(...)` | **37** |
| Named handlers that only toast | 0 |
| `<button>` with no handler | 5 (4 are false positives — `Button`/`IconButton` spread `{...rest}`; 1 real: an intentionally `disabled` CTA in `solo/GameDetailPage.jsx:318`) |
| `confirm()` / `alert()` | 1 real (`owner/PromotionsPage.jsx:83`) |
| `console.*` | 4 (all legitimate error logging, not debug leftovers) |

**Runtime confirmation** — clicked with network capture; every one produced a toast, **zero API calls,
zero downloads**:

| Control | API calls | Download | Toast |
|---|---|---|---|
| owner/bookings → *+ Manual booking* | NONE | NONE | "Manual booking drawer — see Calendar page" |
| owner/bookings → *Next page* | NONE | NONE | "Next page" |
| owner/customers → *+ Add customer* | NONE | NONE | "Add customer form opened" |
| owner/payments → *Monthly report* | NONE | NONE | "Monthly report generated 📈" |
| admin/activity → *Export CSV* | NONE | NONE | "Exporting activity-log.csv 📄" |
| admin/users → *Export roster CSV* | NONE | NONE | "Exporting user roster CSV..." |
| admin/profile → *Change Password* | NONE | NONE | "Password change flow initiated 🔒" |
| OwnerLayout → notification bell | NONE | NONE | "3 new notifications 🔔" (hardcoded) |

---

## 4. Newly Discovered Findings

IDs match `qa/baseline/qa-findings-api.json` exactly. `QA-N04`, `QA-N05`, `QA-N08` and `QA-N10` are
**positive controls** in that file (probes that found no defect) and are listed in the table below
this one.

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| **QA-N01** | `AdminPartBDataSeeder` **never runs** | Medium | It seeds from `@PostConstruct`, which executes *before* every `CommandLineRunner` that creates Part A (users/venues/pitches). Log: *"Cannot run Part B Seeder: required Part A data (Users/Venues/Pitches) is missing."* `GET /api/v1/admin/payouts` → **200 with 0 rows** on every fresh boot. Consequence: admin payouts, 12-month GMV history and audit-log demo data are always empty, which is why admin analytics fall back to fabricated values. |
| **QA-N02** | Registering as `OWNER` auto-creates a venue | Medium | A brand-new owner who has created nothing already owns *"Kick Off Arena", Dhanmondi, DRAFT* (`VenueManagementService` ~line 145 falls back to that literal). Both QA owners received one (ids 51, 52). |
| **QA-N03** | The 10 demo venues are owned by a **PLAYER** | Medium | `VenueDataSeeder` sets `venue.owner` = `rafi@turfchai.dev` (role `PLAYER`). That user gets **403** from every `/api/v1/owner/**` route, so all 10 seeded venues are permanently unmanageable. |
| **QA-N06** | Open-game **join trusts the body `userId`** | **High** | Evidence: `qa/baseline/qa-join-identity-proof.json`. `POST /api/v1/solo/open-games/1/join` as playerZero (844) with `{"userId":848}` → **200**; roster went `842,843,847` → `842,843,847,848`. The caller enrolled a *different* user, and the response reports a payment obligation for that user. `JoinOpenGameRequest.userId` is used instead of the principal. (The same probe confirmed attendance-marking and ticket access **are** correctly restricted.) |
| **QA-N07** | Slot rows generated on demand for **any** date | Low | `?date=1999-01-01` → 24 rows; `?date=<today+300d>` → 24 rows. Storage-growth vector and the enabler for TC-009. |
| **QA-N09** | AI namespace fully public | Medium | `GET /api/ai/metrics` → **200**; `DELETE /api/ai/sessions/{anyId}` → **204** with no auth. Session ids are client-supplied strings, so any known/guessed id can be wiped by anyone. |
| **QA-N11** | Owner booking approve/cancel are orphaned | Medium | `POST /api/v1/owner/bookings/{id}/approve` → **200** and `GET /api/v1/owner/bookings` → 200, yet `owner/BookingsPage.jsx` row actions only call `showToast()` and `api/ownerBookings.js` exposes no approve/cancel function. |
| **QA-N12** | Check-in succeeds on a **CANCELLED** booking | Medium | Evidence: `qa-findings-followup.json`. `POST /matchday/checkin?bookingId=3` (cancelled) → **200**. |
| **QA-N13** | Fabricated admin profile data | Medium | `/admin/profile` shows *"1,204 Actions"*, *"High (2FA)"*, *"Last changed 42 days ago"*, *"2 Devices (Chrome Windows, Mobile App)"* and three static activity rows (*"Suspended user #38112"*, *"Updated turf venue V-0044"*, *"Approved TR-1033 · Mirpur Annex"*) for a super admin who has done none of it. |
| **QA-N14** | Owner customer fields hardcoded | Low | `OwnerCustomerRestController` returns `loyalty: "—"` and `noShows: "—"` literals; the Customers table renders them as data. Confirmed live with two real customers (`Role Esc`, `TC001 TAMPERED`), whose *Last visit* and *Venue loyalty* cells are also empty. |
| **QA-N15** | Flyway never runs in `dev` | Medium (process) | `spring.flyway.enabled=false`; the local schema is `ddl-auto=update`. Migration defects cannot surface in development or in this baseline. |

### Positive controls (verified NOT vulnerable)

| Check | Result |
|---|---|
| Cross-owner venue read / update / promotions / slot-unblock | **403** on all four |
| Booking read / cancel by a stranger | 409 / **403** |
| Payment history + refund preview of another user's booking | **409** (not readable) |
| Role escalation via `register role=ADMIN` / `SUPER_ADMIN` | 403 / 400 |
| Role escalation via `PATCH /api/v1/me` with `role` | ignored — admin routes still 403 |
| Hold a `BLOCKED` slot | **409** |
| Open-game attendance marked by a non-host | **403** |
| Ticket fetched by a non-roster user | **403** |
| Negative `applyWalletAmount` | **400** |
| Promo code validation (correct DTO) | 200 valid / **422** bogus / 400 negative total |
| `passwordHash`, `twoFactorSecret` in API responses | `@JsonIgnore` — never serialized |

---

## 5. Coverage

### Routes exercised (62 total)
All routes were loaded with the rich dataset across anonymous, playerA, ownerA and SUPER_ADMIN
sessions. Pages that were previously untestable now render real content:
`/solo/games/1` (*QA Friendly Match*), `/solo/ticket?gameId=1`, `/player/booking-success?bookingId=4`,
`/player/review?bookingId=1` (*How was Kick Off Arena?*), `/player/cancel?bookingId=2`,
`/owner/customers` (2 real customers), `/owner/promotions` (`QA20`).

**Only two routes crash:** `/player/dashboard/bookings` (TC-003) and `/admin/turfs/:id` (TC-004).

### APIs exercised
91 distinct request/response pairs across auth, players, venues, slots, bookings, payments, reviews,
matchday, tournaments (player + host), open games, tickets, LFG alerts, rewards, notifications,
promotions, pricing, media, owner (venues/pitches/pricing/slots/calendar/bookings/analytics/reviews/
customers/promotions), admin (users/venues/turf-requests/payouts/analytics/admins/audit-log) and AI.

### Not testable in this environment

| # | Item | Why | Needed to test |
|---|---|---|---|
| 1 | Flyway V1–V27 migration chain | disabled in `dev`; local Postgres credentials are wrong on this machine | a PostgreSQL instance + `default` profile |
| 2 | Real payment settlement / refunds / payouts | no gateway integration exists (TC-010) | bKash/Nagad sandbox credentials |
| 3 | Cloudinary media upload | `CLOUDINARY_URL` unset; service falls back to a stub | Cloudinary credentials |
| 4 | AI assistant answer quality | provider quota exhausted; fallback breaker engaged | a funded `OPENROUTER_API_KEY` |
| 5 | Admin OTP delivery | dev returns `devCode` inline | mail/SMS provider |
| 6 | Cross-browser / real-device responsive | single Chromium engine | BrowserStack or equivalent |
| 7 | Load / performance | `scripts/load-test.js` exists but was not run | k6 + a target environment |
| 8 | `AdminPartBDataSeeder` output | the seeder never executes (QA-N01) | fix the lifecycle, or seed via API |

---

## 6. How to Reproduce This Baseline

```powershell
# 1. clean backend (in-memory H2 -> guaranteed fresh)
.\mvnw.cmd -o spring-boot:run "-Dspring-boot.run.profiles=dev"

# 2. frontend
cd frontend; npm run dev

# 3. deterministic dataset  -> qa/baseline/qa-dataset.json
powershell -NoProfile -ExecutionPolicy Bypass -File qa\seed-qa-dataset.ps1

# 4. reproduce findings     -> qa/baseline/qa-findings-api.json
powershell -NoProfile -ExecutionPolicy Bypass -File qa\reproduce-findings.ps1

# 5. supporting proofs
powershell -NoProfile -ExecutionPolicy Bypass -File qa\followup-probes.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\decisive-proofs.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\join-identity-proof.ps1

# 6. dead-control scan      -> qa/baseline/qa-dead-controls.json
powershell -NoProfile -ExecutionPolicy Bypass -File qa\scan-dead-controls.ps1
```

> The `.ps1` files must stay **UTF-8 with BOM** — Windows PowerShell 5.1 otherwise misreads the
> non-ASCII characters and fails to parse.

---

## 7. Recommended Fix Order (for the next agent)

1. **TC-001 / TC-002** — remove `/api/v1/players/**`, `/api/v1/tournaments/**`,
   `/api/v1/host/tournaments/**` from `permitAll`; delete the `X-User-Id` and demo-UUID fallbacks.
2. **QA-N06** — take the joining user from the principal, not `JoinOpenGameRequest.userId`.
3. **TC-006 / TC-007 / QA-N12** — add ownership checks to `checkIn()` and `submitReview()`; reject
   check-in on cancelled bookings.
4. **TC-005** — return a DTO from `ReviewRestController`; audit the other five controllers that return
   entities directly. Repair the venue ratings corrupted by the failed writes.
5. **TC-003 / TC-004** — two one-line frontend fixes; add a render test for each with non-empty data.
6. **TC-009 / QA-N07** — filter past slots server-side and bound on-demand slot generation.
7. **TC-011** — implement or hide the 37 dead controls; the fake approval, review reply, payment and
   password/session controls are actively misleading.
8. **TC-010** — label the payment sheet as a simulation until a gateway exists.
9. **QA-N01 / QA-N02 / QA-N03 / QA-N15** — seeder and environment correctness.
10. **QA-N09 / QA-N11 / QA-N13 / QA-N14** — lock down the AI namespace; wire or remove the orphaned
    owner-booking endpoints; replace fabricated admin/customer values with real data or honest blanks.
11. Add a frontend test runner. A single render test for `/player/dashboard/bookings` with one booking
    and one for `/admin/turfs/:id` would have caught both crashes.

**No fixes were applied. This document is the pre-fix baseline.**
