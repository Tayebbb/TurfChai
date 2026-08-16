# Feature-Connectivity Audit

Every capability named in the QA report was classified against the actual backend, frontend,
routes and domain model before anything was written:

| | Meaning | Action |
|---|---|---|
| **A** | Intended, partially implemented | Complete the integration |
| **B** | Backend capability, missing UI | Build the UI |
| **C** | UI, missing backend | Build the backend or make it honest |
| **D** | Obsolete / dead | Remove after proving nothing depends on it |
| **E** | Genuinely future | Make the UI honest, prevent fake functionality |

**Result:** orphaned frontend API functions **26 → 0**. 400 backend tests (was 393), 64 frontend
tests (was 52), ESLint 0, clean build, clean route-path check, 11 routes browser-smoked with zero
page errors.

---

## 1. Two security holes the audit uncovered

These were not on the list. Both were found by asking *why* an API was disconnected.

### Account takeover through the OTP endpoint

`POST /api/v1/auth/otp/request` is **public** and returned the generated code in the response body
**unconditionally**:

```java
return new OtpRequestResponse(true, "Verification code sent to " + maskPhone(phone), 300, code);
```

Anyone could request a code for any phone number, read it from the response, POST it to
`/auth/otp/verify` and receive that account's JWT.

Fixed by reusing the property the admin 2FA flow already had (`app.otp.expose-dev-code`) so the code
is only echoed in demo mode, and by adding real throttling to `InMemoryOtpService`: 5 codes per
10 minutes per number, 30 seconds between requests, and the code is burned after 5 wrong guesses so
a 4-digit code cannot be walked through inside its lifetime.

Covered by `security/OtpCodeExposureTest`.

### Free bookings through `POST /api/v1/bookings`

This endpoint confirms a held slot into a **CONFIRMED booking with no payment row**. Its own javadoc
said it *"should stay restricted to trusted integrations"* — but nothing restricted it, and any
signed-in player could call it. Owner revenue is derived from booking status, so this booked pitches
for free.

Now `@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")`. Players book through
`/api/v1/payments/checkout`, which records a payment first. Covered by
`BookingRestControllerTest#createBooking_isRefusedForPlayers`.

### And one honesty failure of the same severity

`CheckoutPage` ran a fake gateway that collected a **16-digit card number, expiry, CVV and mobile
wallet PIN**, validated them, showed a spinner, and threw them away — they were never transmitted
anywhere. There is no payment provider behind TurfChai. Training users to type real card details
into a form that does nothing is worse than not having the form.

The entire `account → pin → processing → success` sequence is gone. What remains is one confirmation
step that says plainly: *"TurfChai does not take payment online yet. Confirming reserves the slot and
records ৳X as due by bKash — you pay the venue directly. Never enter a card number or wallet PIN
here."* The payment method the player picks is real and is stored on the payment record.

---

## 2. Classification and outcome

### A — partially implemented, completed

| Capability | What existed | What was missing | Done |
|---|---|---|---|
| **Wallet history** | `WalletTransaction` entity, repository, and writes on every reward credit and checkout | No endpoint could read the ledger back | `GET /api/v1/rewards/wallet` + a real `WalletSection` (balance and the entries behind it) |
| **Player statistics** | Bookings, check-ins, memberships, reviews, reliability score | No aggregation, no endpoint | `GET /api/v1/players/me/stats` + a real `StatsSection` |
| **Booking-success orphan** | A complete page with QR, calendar, directions | Nothing navigated to it; checkout rendered its own inline success screen | Checkout now routes to it with the real booking id and points earned |

Player statistics deliberately **exclude a win rate**. TurfChai records that a pitch was booked and
whether the player turned up — never a score. A win rate would have to be invented, so the page says
so instead.

### B — backend existed, UI built

| Capability | Endpoint that had no caller |
|---|---|
| **Open-game creation** | `POST /api/v1/solo/open-games` — the single biggest gap: players could browse and join games but there was **no form, button, modal or route** to create one |
| **Promotion pause / edit** | `PATCH /…/promotions/{id}` — the page showed an Active/Paused badge with no control |
| **Pitch retirement** | `DELETE /…/pitches/{pitchId}` — pitch rows had Edit only |
| **Slot price editing** | `PUT /api/v1/owner/slots/{id}` |
| **Slot generation** | The modal was **fully built** — pitch, dates, times, duration, price, wired to the API — but `generateSlotsModal.open()` was never called from anywhere. It had no trigger |
| **Admin payouts** | `GET/POST /admin/payouts…{,/settle,/flag}` — only `listPayouts` was used, to sum a KPI |
| **Phone sign-in** | `/auth/otp/request` + `/verify`, and an `OtpInput` component imported by nobody |
| **Host add-team** | `POST /host/tournaments/{code}/teams` |
| **ML pricing** | `POST /api/v1/pricing/quote` — a real ONNX model, a per-venue `mlPricingEnabled` flag, and zero UI |

Two backend defects were fixed while wiring these:

- `CreateOpenGameRequest.organizerUserId` was `@NotNull` but **ignored** by the controller (the
  organiser comes from the JWT, a deliberate earlier security fix). A correct client got a 400 for
  omitting a value the server discards. Constraint removed.
- The promotion `PATCH` read two fields out of a raw `Map<String,Object>` with unchecked casts, so
  `{"active": "yes"}` was a `ClassCastException` → 500, and nothing else was editable. Replaced with
  a validated `UpdatePromotionRequest` that supports a real partial update.

**"Password reset" is answered by phone sign-in.** There is no password-reset token, mailer or
endpoint anywhere in the backend, and inventing that subsystem would be a large speculative feature.
But the OTP endpoints already provide passwordless entry, so the sign-in screen now offers *"Forgot
your password? → Sign in with a phone code"*. That is a real recovery path built on real backend.

**ML pricing** is surfaced where an owner can act on it: opening an available slot shows
*"Suggested ৳2,016 — from the pricing model, using this day's real occupancy"* with a "Use it"
button. Every input is measured, not guessed: occupancy is the actual booked ratio of that day's
grid, and days-before is computed from the calendar date. Verified live returning multiplier 1.479.

### D — dead, removed after proving no dependency

Each was checked with an importer scan (`qa/audit-dead-modules.ps1`) before deletion.

- `api/games.js` — a duplicate of `api/openGames.js` carrying fabricated values (`distance: 1.5`,
  `rating: '4.8'`, `time: 'tonight'`).
- `api/ownerStaff.js`, `api/ownerVenueSetup.js` — call endpoints that **do not exist** on the server.
- `api/health.js` + `apiFetch` — no consumer.
- Six unused `src/data/*` mock modules.
- `createBooking`, `cancelBooking`, `formatTimestamp`, `getOwnerSlots`, `checkInTicket`,
  `toJoinableTournamentCard`.
- `PaymentRetryPage` and its route — unreachable, and its copy ("no card, bKash or Nagad charge
  anywhere in the booking flow") contradicted the checkout that does record a payment.

Fabricated content presented as real, removed:

- The admin bell's four invented "platform alerts" (*"Mirpur Sports City submitted trade licence
  documents 3 days ago"*, *"৳4,82,000 across 38 venues is queued"*) → real notifications.
- Admin profile: *"2 Devices (Chrome Windows, Mobile App)"*.
- Promotions: *"Tue–Wed 2–4 PM is 71% empty"* and named customers *"Rafiul K. (9/10), Karim
  Traders (15 visits)"* → honest "Quick starts" templates.
- Admin dashboard: disbursed payouts falling back to `Math.round(gmv * 0.9)` when the API returned
  nothing — a synthesised figure displayed as a financial fact.

### E — genuinely absent, kept honest

No backend exists for these at all, and none was invented: **teams/squads**, **player network**,
**staff & shifts**, **split payments**, a **real payment gateway**, **admin session revocation**
(JWTs are stateless — there is nothing on the server to revoke), **server-side CSV/PDF export**
(CSV is generated client-side; there is no PDF generator, and nothing claims one).

The dashboard sidebar now marks only teams and network as "soon" — wallet, statistics, bookings and
notifications became real, so their badges were removed.

`checkInTicket` was deleted rather than left dangling, with a note in `api/tickets.js` explaining
that the gate-scanner screen does not exist and booking check-in is done from the owner calendar.

---

## 3. Verification

**Automated** — backend `mvnw -o test` → 400 passed, including `FeatureConnectivityTest` (wallet,
stats, open-game contract) and `OtpCodeExposureTest`. Frontend `npm test` → 64 passed, including
`CheckoutPage.test.jsx` (asserts no `cc-number`/`cc-csc`/PIN field exists and that no credential
leaves the browser), `CreateGameDrawer.test.jsx` and `WalletStatsSections.test.jsx`.

**Live, against the running stack**

| Check | Result |
|---|---|
| `POST /bookings` as a player | **403** (was a free booking) |
| Second OTP request for one number | **400** throttled |
| Checkout page credential fields | `cc-number: 0, cc-csc: 0, PIN labels: 0` |
| Full checkout | Landed on `/player/booking-success?bookingId=1` with a real QR, real booking code and 2,010 points |
| Post an open game | Toast, then the server feed lists it with the right organiser, venue, time, price and spots |
| Pause a promotion | Server flipped `active: true → false`; badge became "Paused", button "Resume" |
| Edit a slot price | Saved 1,800 → 2,750, confirmed via the calendar API |
| ML suggestion | "Suggested ৳2,016", applying it filled the field |
| Wallet | Showed the real ৳50 reward credit and its ledger entry |
| Statistics | 1 booking, 1 venue played, 2 open games, ৳2,000 spent, favourite venue "Metro Futsal" |
| Admin payouts | Page, filters and honest empty state; export disabled when empty |
| Admin bell | Real notifications; the invented alerts are gone |
| 11 owner/player routes | 0 page errors |

**Standing guards:** `qa/audit-orphans.ps1` (reports 0), `qa/audit-dead-modules.ps1`,
`qa/audit-connectivity.ps1`, `qa/scan-fake-handlers.ps1`.
