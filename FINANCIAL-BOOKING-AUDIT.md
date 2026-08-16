# Financial Systems & Booking Engine — Audit and Remediation

Scope: the full money path — SEARCH → VENUE → SLOT → HOLD → CHECKOUT → PAYMENT →
CONFIRMATION → SUCCESS → BOOKING MANAGEMENT → CANCELLATION → REFUND.

Verdict before this pass: **the money path could not be trusted.** A cancellation
could pay out more cash than was ever collected, an owner could refund another
venue's bookings, and a read-only reporting endpoint wrote rows to the database.

Verdict after: **booking, payment, cancellation and refund agree across frontend,
backend and database**, verified by 426 backend tests, 64 frontend tests, a live
API lifecycle script and a real browser walkthrough.

---

## Is payment real or simulated?

**Simulated, and now stated plainly everywhere.**

There is no payment gateway client anywhere in the codebase. `PaymentService`
writes ledger rows and returns; nothing is contacted over the network. No card
number, PIN, CVV or token is accepted, transmitted or stored — those fields were
removed in an earlier pass and have not returned.

This is now said out loud in three places rather than implied:

- `PaymentService`'s class javadoc.
- Checkout: *"TurfChai does not take payment online yet. Confirming reserves the
  slot in your name and records ৳X as due by bKash — you pay the venue directly.
  Never enter a card number or wallet PIN here."*
- Booking success and the booking detail page describe amounts as **recorded**
  and **due at venue**, never as received.

The `payments` table is therefore a record of what is owed and to whom, not a
record of settled card transactions. Everything below is about keeping that
record honest.

---

## What was wrong

### 1. A cancellation paid out money that was never collected — Critical

A ৳2,000 booking part-paid with ৳500 of wallet credit charged the gateway ৳1,500.
On cancellation the refund was computed from `booking.netAmount` — the full
৳2,000 — and paid entirely as cash. The venue lost ৳500 it never received, and
the player's ৳500 of credit was gone too: they were down ৳500 *and* the platform
was out ৳500.

Refunds are now split by tender. The gateway is refunded only what the gateway
received; wallet credit goes back to the wallet.

### 2. Never-paid bookings were fully refundable — Critical

`cancelAndRefund` checked neither the booking status nor whether any payment
existed. A PENDING booking that had never been charged would still produce a
REFUND row for the full policy percentage. The lookup for the original payment
tolerated `null`, so there was nothing to stop it.

A booking with no successful payment now refunds nothing, because nothing was
taken.

### 3. A read-only GET wrote to the database — Critical

`OwnerPaymentService.getPaymentSummary` — annotated `@Transactional(readOnly = true)`
— contained a loop that **inserted CONFIRMED bookings** for slots it considered
unreconciled. On PostgreSQL that is a 500 on a dashboard load. On the H2 dev
database it silently fabricated bookings, and each one consumed the slot's entry
in the one-active-booking-per-slot unique index — quietly making real slots
unsellable.

The loop is gone; the endpoint now counts what it used to create.

### 4. Owner earnings were fiction — Critical / High

Three separate faults in the same report:

- `refunds` was hardcoded to `BigDecimal.ZERO`, so `netToYou` equalled gross. The
  `paymentRepository` was injected and never used.
- Online versus cash was decided by `bookingCode.startsWith("BKG-")`. Booking
  codes are `TC-` and `MB-`, so **nothing ever matched**: platform fees were
  permanently ৳0 and every online booking was reported as cash.
- KPI deltas were literals — `"+0% vs yesterday"`, `"0 cancellations"`.

All three now come from the payment ledger and the real booking counts.

### 5. A fully wallet-funded booking had no payment record — High

If wallet credit covered the whole price the gateway leg was ৳0, no `Payment` row
was written at all, and the API still returned `status: "SUCCESS"` with
`payment: null`. A CONFIRMED booking with an empty ledger is exactly the state
the brief forbids.

The wallet leg is now ledgered as its own `Payment` row, so a confirmed booking's
payments always sum to its price.

### 6. Points were a free farm — High

Points were awarded on payment and never reversed on cancellation. Book, cancel
inside the free window, keep the points, repeat.

Cancelling now reverses exactly what that booking awarded, and is idempotent.

### 7. Refund tiers drifted with the server's timezone — High

`hoursUntilStart` used `LocalDateTime.now()` — the JVM default zone — against slot
times that are local wall-clock and timestamps stored in UTC. Every refund tier
was silently offset by the deployment's zone.

The clock is now injected, so tier boundaries are testable and deployment-independent.

### 8. Owners could act on each other's bookings — Medium

`canAccess` granted any user holding OWNER, ADMIN or SUPER_ADMIN access to *any*
booking. Venue B's owner could read, cancel and refund Venue A's bookings.

Owner access is now scoped to bookings at venues they actually own.

### 9. The hold was re-locked but never re-checked — Medium

`finalizeConfirmedBooking` took the row lock and then confirmed unconditionally.
An expired hold, an already-confirmed booking, or a slot that had since started
would all still be converted into a CONFIRMED booking.

It now verifies the booking is PENDING, the slot has not started, and the caller
still owns a live hold — and says so: *"The hold on this slot expired before
payment completed — nothing was charged."*

### 10. Owner manual booking bypassed every guard — Medium

`createManualBooking` read the slot **without a lock**, never checked its status,
never checked whether it had already started, invented a ৳2,000 price when none
was given, invented `16:00`/`17:30` times, and set `pitchId(0L)` when the slot had
no pitch — a guaranteed foreign-key violation.

It now locks the slot, refuses started/booked/blocked slots, and refuses to invent
prices or times.

### 11. Transaction references had 32 bits of entropy — Medium

`"PAY-" + 8 hex characters`, checked for existence before insert. Small enough to
collide in a busy ledger, and the check-then-insert is racy: two concurrent
checkouts could both pass and then fight over the unique constraint, failing a
legitimate payment with a generic 409.

Now a full UUID, with no pre-check needed.

### 12. Bookings had no optimistic locking — Medium

Confirm and cancel both read a booking, decide on its status, then write. With no
version column a cancel could land on top of a confirm — leaving a paid booking
marked CANCELLED, the slot released, and the money taken.

### 13. The wallet could be overdrawn — Medium

Wallet balance is a sum over a ledger. Two concurrent checkouts could each read
৳500 and each spend it in full.

Wallet spends now serialise on the owning user row.

### 14. Refund terms could change after the player paid — Medium

The refund percentage was computed against the venue's *current* cancellation
policy. An owner could tighten their terms after a player had paid and keep money
the player was owed. The `cancel_policy_snapshot` column existed in the schema
and was never written.

The agreed policy is now pinned to the booking at confirmation and used for every
later refund quote.

### 15. The UI reported the wrong amount on split payments — Medium

Found during the browser walkthrough, after the backend was already correct:

- Booking success said *"৳150 payable by BKASH"* when ৳2,350 was due — it read the
  first payment row it found, which was the wallet leg.
- Booking detail showed *"Total paid ৳150"* for the same reason.
- The wallet leg was labelled *"BKASH payment received"*.
- The refunded total omitted the wallet portion, because only the cash leg was in
  the ledger.
- The wallet leg — not the gateway charge — was the row flipped to `REFUNDED`,
  leaving the real ৳2,350 charge still reading as a completed sale.

The API now exposes which tender a row represents, both refund legs are ledgered,
and the reversal targets the gateway charge.

---

## Also cleaned up

- `V9__bookings_active_slot_unique.sql` contained its `CREATE UNIQUE INDEX`
  statement **twice** and a duplicated `-- V8:` / `-- V9:` header.
- `Payment` had no `@PreUpdate`, so a row flipped to REFUNDED kept the timestamp
  of the original charge.
- A `uq_bookings_active_slot` violation surfaced as *"Database constraint error:
  duplicate or invalid data"*. It now reads *"Someone just took this slot. Please
  pick another time."*
- `OwnerPaymentService` truncated money instead of rounding it.

---

## Known and accepted

**Dev and test run without the Flyway constraints.** The dev profile uses H2 with
`spring.flyway.enabled=false` and `ddl-auto=update`. Every check constraint and
partial unique index in `db/migration` therefore exists **only in production**.
The unique index that prevents double-selling a slot is not active in dev or in
the H2 test suite — the pessimistic row lock is what the tests actually exercise.
Worth closing before launch, either by running Flyway against a containerised
Postgres in tests or by moving dev onto Postgres.

**`BookingStatus` has three values; the database allows eight.**
`ck_bookings_status` permits `PAID`, `PARTIALLY_PAID`, `NO_SHOW`, `COMPLETED` and
`EXPIRED`, none of which the enum can represent. The V9 index keys off
`PAID`/`PARTIALLY_PAID`, which nothing writes.

**`PaymentStatus.FAILED` is never written.** Nothing can fail, because nothing is
really charged. This becomes real work the day a gateway is integrated.

**`PricingQuoteResponse` uses `float` for money.** It is advisory only and never
persisted, but it should not be a float.

---

## How this was verified

**Automated**

- 426 backend tests (`mvnw test`), including:
  - `PaymentLifecycleIntegrationTest` — 15 tests over a real database covering
    split-tender refunds, wallet-only bookings, never-paid bookings, double
    refunds, points clawback, past slots, blocked slots, expired holds, duplicate
    payments, slot release, and a ledger-reconciles-to-price invariant across
    every confirmed booking.
  - `BookingAccessControlIntegrationTest` — cross-owner isolation and policy
    snapshotting.
  - `BookingConcurrencyIntegrationTest` — 16-way races on hold and confirm, 16-way
    race on pay, and concurrent wallet spends.
- 64 frontend tests, ESLint clean, production build clean, route check clean.

**Live API** — `qa/verify-money-lifecycle.ps1` walks a real player through the
whole lifecycle against the running backend and asserts booking state, ledger and
wallet agree at every step.

**Live browser** — signed in, booked a ৳2,500 slot with ৳300 of wallet credit,
confirmed, then cancelled inside the 50% window:

| | Expected | Shown |
|---|---|---|
| Charged to bKash | ৳2,200 | ৳2,200 |
| Covered by wallet | ৳300 | ৳300 |
| Refunded to bKash | ৳1,100 | ৳1,100 |
| Returned to wallet | ৳150 | ৳150 |
| Total refunded | ৳1,250 | ৳1,250 |
| Net paid | ৳1,250 | ৳1,250 |
| Wallet balance | 300 → 0 → 150 | 300 → 0 → 150 |

Frontend, backend and database agreed on every figure.
