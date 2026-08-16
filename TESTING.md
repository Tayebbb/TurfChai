# Running the tests

This is the operator's manual: how to run each layer, and what to do when one
fails. For what each layer *proves* and the current verified counts, see
[docs/testing.md](docs/testing.md).

Six layers, each catching what the one below it cannot.

| Layer                 | What it proves                                                                                 | Where                        |
| --------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| Backend (JUnit)       | Domain rules, authorization, money invariants, concurrency                                     | `src/test/java`              |
| Frontend (Vitest)     | Component and page behaviour against mocked APIs                                               | `frontend/src/**/*.test.jsx` |
| Frontend honesty      | No handler hides a failure or reports success it did not achieve                               | `frontend/scan-honesty.mjs`  |
| Live API (PowerShell) | Every role against a running server, plus the cross-role attack matrix                         | `qa/*.ps1`                   |
| Browser (Playwright)  | Real user journeys with nothing mocked                                                         | `frontend/e2e`               |
| End-to-end journeys   | Whole workflows, with UI, URL, API and database checked against each other at every transition | `frontend/qa/journey-*.mjs`  |

Current size, all green:

| Layer                         | Count                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Backend (JUnit)               | 492                                                     |
| Frontend (Vitest)             | 126 across 24 files                                     |
| Frontend honesty              | every `catch` in `frontend/src`, 14 reviewed exemptions |
| Live API role matrix          | 140 checks, 8 roles                                     |
| Live API contract audit       | 28 checks                                               |
| Live TC regression matrix     | 27 checks (TC-001..TC-032 + QA-N07/N09)                 |
| Live adversarial break        | 23 checks                                               |
| Live data integrity           | 14 checks                                               |
| Live multi-agent probe        | 25 contract / security / robustness assertions          |
| Route crawl                   | 105 route visits across 6 actors                        |
| Journey: player               | 21 checks                                               |
| Journey: owner / host / admin | 21 checks                                               |
| Journey: cross-area state     | 23 checks                                               |
| Journey: interruptions        | 13 checks                                               |
| Cross-surface consistency     | 60 checks                                               |
| Promotion redemption flow     | 12 checks                                               |
| Venue amenities flow          | 6 checks                                                |
| Player notification flow      | 16 checks                                               |
| Solo open games flow          | 12 checks                                               |
| Accessibility + responsive    | 45 page/viewport combinations                           |
| Browser (Playwright)          | 35                                                      |

## One command

```powershell
pwsh qa/run-qa.ps1
```

Starts anything that is not already running, runs all four layers, stops only
the servers it started, and prints a pass/fail line per stage. Exit code is
non-zero if any stage fails.

Useful variants:

```powershell
pwsh qa/run-qa.ps1 -Quick         # static gates only, no servers required
pwsh qa/run-qa.ps1 -SkipE2E       # everything except the browser suite
pwsh qa/run-qa.ps1 -KeepServers   # leave the stack up for debugging
```

### If the admin stages fail with 401

`POST /admin/auth/login` is throttled to five challenges per fifteen minutes per
account. The gate therefore signs in **once**, in the `admin session (shared
across stages)` step, and exports `QA_ADMIN_TOKEN`; every admin-dependent script
reuses it. Before that, seven stages each signed in separately and exhausted
`admin0..3` mid-run, so late stages failed with 401 for no product reason.

If that step itself fails, all four admins are throttled — the limiter is
in-memory, so restarting the backend clears it.

## The journey layer

Every other layer checks a screen or an endpoint. These four check a _workflow_,
and at each transition they require the UI, the URL, the API response and the
database to agree with one another. A screen that says a booking is confirmed
when no row exists fails here even though the page renders perfectly.

```powershell
cd frontend
node qa/journey-player.mjs        http://localhost:4173
node qa/journey-roles.mjs         http://localhost:4173
node qa/journey-crossarea.mjs     http://localhost:4173
node qa/journey-interruptions.mjs http://localhost:4173
```

**`journey-player.mjs`** — landing, registration, onboarding, profile, explore,
search, filter, venue, slot, checkout, payment, confirmation, history, detail,
cancellation, refund, points reversal, saved venue, notifications, logout.

**`journey-roles.mjs`** — the owner, host and admin workspaces, written around
cross-area consistency: a cancellation policy the owner saves has to reach the
public venue record _and_ the refund table a player reads; a slot the owner
blocks has to stop being holdable; a team the host accepts has to appear on the
player's tournament page.

**`journey-crossarea.mjs`** — the state machines that span two roles: tournament
registration (`none → registered → paid`, `registered → withdrawn`, and the
moves that must be refused), reviews (`none → published`, and that a review
reaches the public venue page), and promotions (`none → active → inactive`, with
the discount, the cap, the minimum and the venue scope all enforced).

**`journey-interruptions.mjs`** — what users actually do: refresh mid-checkout,
double-click Confirm, press Back after paying, close and reopen the tab, race a
second player for the same slot, act on a tab whose facts have gone stale, keep
a tab open until the session dies, lose the network, and sit on a slow one. Each
has to recover into a truthful state and let the workflow continue.

Two defects these found, both fixed:

- `tournaments/:code` sat outside `RequireAuth`, so an anonymous visitor got a
  dead "Authentication is required / Try again" panel instead of a sign-in page.
- `TournamentService.register` guarded duplicate _team names_ but never checked
  whether the player already had an entry, while `withdraw`, `myTournaments` and
  the tournament card all resolve a player to exactly one team. A second
  registration therefore produced a state the player could not leave: withdrawal
  removed the earliest entry, and once that one was paid it refused outright
  with the other still registered.

## Cross-surface consistency

```powershell
cd frontend
node qa/consistency-audit.mjs http://localhost:4173
```

The journey suites ask whether a workflow works. This one asks whether the same
fact, reported in six different places, is the same fact. It performs a real
action and then traces the result through every surface that claims to describe
it: player screens, owner console, admin console, public catalogue, ledgers and
aggregates. A contradiction counts even when every individual screen renders
perfectly.

It covers a booking (catalogue price → hold → checkout → ledger → confirmation →
history → detail → availability → owner list → customer record → analytics), a
renamed user, an edited venue, a tournament seen from three sides, every payment
transition, and a new review.

Four defects it found, all fixed at the source rather than on the screen:

- **The player was never told which turf or pitch they had booked.** The booking
  record carries `venueName`, `venueArea` and `pitchName`, and every owner
  surface shows them — but the confirmation ticket and the booking detail page
  used them only for the Directions and Contact buttons. Both now show them.
- **The owner dashboard counted a booking as today's trade because it was _sold_
  today.** `isToday` was `bookingDate == today || createdAt == today`, so a
  fixture sold now for next week landed in "Today's revenue" and "Bookings
  today" — and would be counted again on the day it was played, beside an
  Occupancy KPI that correctly reported nothing booked for today. Now "today"
  means played today. Regression:
  `OwnerDashboardOccupancyTest#aBookingSoldTodayForALaterDateIsNotTodaysTrade`.
- **The owner payments period had no upper bound.** `bDate >= startDateFilter`
  meant "Gross today" also swept in every booking already sold for a future
  date. The window is now closed at both ends.
- **Customers were credited with visits that had not happened.** "Last visit"
  was the maximum booking date across all bookings including cancelled and
  future ones, so the column showed dates in the future (2 of 30 seeded
  customers), and the loyalty badge beside it counted the same unplayed
  fixtures. A visit is now a confirmed booking whose kick-off has passed.

One gap it found and did **not** paper over: nothing writes a player-facing
notification. `NotificationService` is called only for payouts and turf
approvals, both owner events. The player feed says "All caught up!", which is
honest, so the audit asserts that the screen, the feed and the unread badge
agree rather than inventing a notification system.

## The adversarial layers

### `qa/adversarial-break.ps1`

Tries to make the server misbehave: forged, tampered, `alg=none` and expired
tokens; identity spoofing through five different headers; role escalation via
the profile body; cross-user and cross-owner reads; two players racing for one
slot; SQL/XSS/traversal payloads; malformed and deeply nested bodies; hostile
ids; date extremes; pagination extremes; and abusive checkout amounts.

Two assertions here are deliberately _not_ status-code based, because the
obvious version of each was wrong:

- The owner dashboard is caller-scoped, so it answers 200 to a foreign
  `venueId` and simply ignores it. It must be judged by comparing response
  bodies, not by demanding 403.
- A Bangla name must round-trip byte-for-byte. `application/json` carries no
  charset (correct per RFC 8259) and PowerShell then assumes Latin-1, so
  responses must be decoded from `RawContentStream` or every non-Latin string
  looks corrupted when it is not.

### `frontend/qa/ui-crawl.mjs`

Enumerates every route in `src/routes/AppRoutes.jsx` — including dynamic
parameters and redirects — and exercises each under direct navigation, refresh,
back/forward, the correct role, the wrong role, anonymous, valid ids and hostile
ids. Fails on a crash, blank page, `pageerror`, console error, unexpected failed
request, or a guarded route that renders instead of redirecting.

Routes are read from the router on purpose: the previous crawler used a
hand-written list and silently missed every `:param` route.

### `frontend/qa/interaction-crawl.mjs`

Clicks every button, link, tab, switch, checkbox, radio, select and summary each
role can reach, then decides whether anything actually happened — a navigation,
an API call, a state change, a produced file, or a rendered change. An enabled
control that does none of those is a dead control. Destructive labels are
reported rather than clicked, so they appear in the inventory instead of
vanishing from it.

Run it on demand (`node qa/interaction-crawl.mjs`); it is slower than the gate
stages. Four traps it exists to avoid are documented in the file header — most
importantly that a `<select>` cannot be exercised with `click()`, and that a
toast left by the previous control will otherwise be credited to the next one.

### `frontend/scan-honesty.mjs`

Walks every `catch` block in `frontend/src` and fails on any that neither tells
the user, re-raises, forwards the error into state, nor aborts the operation -
especially one followed by a success message that runs regardless. That exact
shape shipped three real defects: a cancellation policy that was never saved, a
trade licence that was never uploaded, and a suspension that never took effect,
all three reported to the user as success. Deliberate degradations are listed in
`ACCEPTED` with the reason they are safe, so the gate only fails on new ones.

### `qa/multi-agent-probe.ps1`

Three sections against the running server: the venue policy vocabulary really
reaching the database, a cross-user / cross-owner / cross-host attack matrix,
and malformed-input handling. Every actor is discovered at runtime rather than
hardcoded - an earlier version reported tournament tampering because it attacked
with an account that turned out to be the tournament's own host.

### `qa/rc-tc-verify.ps1`

Re-runs the original reproduction for every historical finding (TC-001..TC-032)
and demands the safe answer, so a fix is proved by the server rather than by
reading the source. It creates its own booking fixture and discovers its own
owners, because a probe that skips its subject proves nothing.

Two traps this script exists to avoid, both of which silently turned real
assertions into passes:

- `Invoke-WebRequest` throws on 4xx, and the error stream must be rewound
  (`$stream.Position = 0`) or every error body reads as empty.
- PowerShell member enumeration means `$array.items` returns one `$null` per
  element - a truthy array. Always test `-is [System.Array]` before probing for
  a wrapper property.

## Layer by layer

### Backend

```powershell
./mvnw.cmd -o clean test                        # all of it
./mvnw.cmd -o test "-Dtest=PaymentLifecycleIntegrationTest"
```

Always use `clean` when tests have changed: the IDE's Java language server
writes half-compiled classes into `target/test-classes`, and Maven will happily
skip recompiling them, producing `Unresolved compilation problem` at runtime.

### Frontend components

```powershell
cd frontend
npm test              # once
npm run test:watch    # while working
```

Page components that read route parameters must be mounted with `renderRoute`
from `src/test/testUtils.jsx`. Rendering them directly leaves every id
`undefined`, which quietly turns the page into an empty state and makes a
useless test look green.

### Live API and role matrix

Needs the backend running.

```powershell
pwsh qa/qa-all-roles.ps1            # 140 checks across all 8 roles
pwsh qa/verify-money-lifecycle.ps1  # book → pay → cancel → refund
pwsh qa/verify-data-integrity.ps1   # every displayed figure traces to real data
```

`qa-all-roles.ps1` is the authorization guard: it signs in as anonymous, two
players, two owners, a host, an admin and a super admin, then points every role
at every other role's data. Only 401 and 403 count as a refusal — a 404 would
pass for a route that merely does not exist.

`verify-data-integrity.ps1` is the fabrication guard. Screens are allowed to say
"—" but not to invent a number, so it asserts that occupancy, weekly takings,
customer no-shows, payment-method splits, venue analytics and the loyalty ladder
all come from the database. It rotates across `admin0..3` because of the 2FA
throttle, and skips the admin section rather than failing if all four are cooling
down.

### Accessibility and responsive

Needs both servers running.

```powershell
cd frontend
node qa/a11y-audit.mjs              # axe-core over every shell x 3 viewports
node qa/a11y-detail.mjs             # the failing elements, with colour ratios
```

`a11y-audit.mjs` signs in as a player, an owner and an admin, visits the major
routes at 390/768/1440 px, and fails on any critical or serious axe violation or
any route that scrolls sideways. `a11y-detail.mjs` prints the exact selectors and
contrast ratios for whatever the sweep reported, which is what you need to fix
them.

The most common cause of a contrast failure here has been `opacity` used to mark
something locked, dimmed or read. Opacity fades the text along with everything
else and drops it under 4.5:1 — de-emphasise with a background or a muted colour
instead.

### Browser end-to-end

Needs both servers running.

```powershell
cd frontend
npx playwright test                         # all specs
npx playwright test e2e/specs/booking-money.spec.js
npx playwright test --headed --debug        # watch it happen
npx playwright show-trace e2e/.artifacts/<test>/trace.zip
```

Nothing is mocked here. The browser drives the real Vite build, which calls the
real API, which writes to the real database — and each spec then re-reads the
backend to confirm the UI told the truth.

Every spec automatically captures page errors, console errors and failed
requests through the `diagnostics` fixture, so a screen that renders correctly
while quietly 500-ing in the background still fails.

## How the E2E suite gets its data

`e2e/global-setup.js` runs before the specs. It waits for both servers, signs in
one account per role from the seeded demo dataset, and writes them to
`e2e/.state/e2e-state.json`.

Two things are worth knowing:

- Admin sign-in is two-factor and the backend allows only **five codes per
  fifteen minutes per account**. Setup therefore reuses a still-valid session
  when it can and rotates across `admin0..3@turfchai.com` when it cannot. This is
  why the state file lives outside `outputDir`, which Playwright wipes each run.
- Owners are ordered so that ones with real bookings come first. The
  tenant-isolation specs need somebody else's data to fail to reach; against
  empty tables they would pass without proving anything.

Seeded credentials (dev profile only): `rafi@turfchai.dev` / `demo1234`,
everything else `Demo@12345`.

## Writing tests that are worth having

- Assert on behaviour, not existence. "The page rendered" catches nothing.
- Prefer three-way agreement in E2E: what the browser shows, what the API
  returned, and what the backend still holds afterwards.
- Never let a test skip silently past the thing it exists to check. If the data
  it needs might be missing, create it.
- Check the negative too: after an attacker's request is refused, confirm the
  target is still intact.
- A screen may say "—". It may not say a number it did not measure. When a test
  covers a figure, assert both that the real value appears **and** that the old
  invented one does not.

## Proving the suite actually bites

A test that never fails is decoration. Two deliberate regressions were injected
and then reverted, to confirm each layer reports them:

| Injected fault                                          | Caught by                                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `BookingDetailPage` sums only the first payment row     | Vitest — 2 failures, "Net paid ৳-1,100"                                                                                                  |
| `BookingService.canAccess` returns `true` for any owner | JUnit `BookingAccessControlIntegrationTest` (2 failures) **and** Playwright `access-control.spec.js` ("Expected: >= 400, Received: 200") |
| Owner occupancy hardcoded back to `"100%"`              | JUnit `OwnerDashboardOccupancyTest` — 2 failures, "but was: 100%"                                                                        |

Repeat this whenever a layer starts looking suspiciously reliable.

## A trap in the PowerShell scripts

`qa/*.ps1` must stay pure ASCII, and must be written without a BOM.

Windows PowerShell 5.1 reads a BOM-less file as ANSI. A UTF-8 em dash then
decodes to `â€”`, whose last byte is a curly closing quote — which PowerShell
accepts as a **string delimiter**. Every quote after it pairs up wrong and the
file dies with a misleading `Missing closing '}'` hundreds of lines away.

When writing these files from a script, use:

```powershell
[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding $false))
```

`Set-Content -Encoding UTF8` adds a BOM, which breaks Java and JavaScript source
files instead.

Related: the sub-scripts report through `Write-Host`, which bypasses the
pipeline. `run-qa.ps1` folds every stream in with `*>&1` before reading their
verdicts; `2>&1` alone silently captures nothing.
