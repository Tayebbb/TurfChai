# TurfChai — Testing

This document explains **what each test layer proves** and reports the verified
counts. For the per-command operator's manual — how to run each script on its
own, what to do when a stage fails, and the traps in the PowerShell probes —
see [../TESTING.md](../TESTING.md).

Testing is organised as layers that each answer a different question. The whole
set runs from one command:

```powershell
pwsh qa/run-qa.ps1
```

It starts anything not already running, runs every stage, stops only the servers
it started, prints a pass/fail line per stage, and exits non-zero if any stage
fails.

---

## The layers

| Layer | Question it answers | Where |
|---|---|---|
| Backend unit + integration | Does the business logic hold, including under concurrency? | `src/test/java` (64 test classes) |
| Frontend component | Does each screen render its three states — loading, error, empty — and send the right request? | `frontend/src/**/*.test.{js,jsx}` (24 specs) |
| Lint | Is the source free of unused/undefined symbols? | `npm run lint` |
| Honesty scan | Does any `catch` swallow a failure and report success? | `frontend/scan-honesty.mjs` |
| Production build | Does the shipped bundle build? | `npm run build` |
| Live API + role matrix | Does every endpoint answer correctly for every role? | `qa/qa-all-roles.ps1` |
| Money lifecycle | Does what is refunded equal what was taken, by tender? | `qa/verify-money-lifecycle.ps1` |
| Data integrity | Do cross-table invariants hold after real writes? | `qa/verify-data-integrity.ps1` |
| API contract audit | Do responses leak entity internals or identifiers? | `qa/api-audit.ps1` |
| Regression matrix | Is every historical defect (TC-001…TC-032) still fixed? | `qa/rc-tc-verify.ps1` |
| Adversarial | Does hostile input, tampered identity or a forced transition get through? | `qa/adversarial-break.ps1` |
| Multi-agent | Do concurrent actors competing for one resource stay consistent? | `qa/multi-agent-probe.ps1` |
| Route crawl | Does every route render without a console or network error, for every actor? | `frontend/qa/ui-crawl.mjs` |
| Journeys | Do whole workflows agree across UI, URL, API and database at every step? | `frontend/qa/journey-*.mjs` |
| Cross-surface consistency | Do two screens ever disagree about the same fact? | `frontend/qa/consistency-audit.mjs` |
| Feature flows | Do promotions, amenities, notifications, open games and reviews work end to end? | `frontend/qa/*-flow.mjs` |
| Accessibility | Any axe-core violations across pages and viewports? | `frontend/qa/a11y-audit.mjs` |
| Browser E2E | Do the critical paths work in a real browser? | `frontend/e2e` (Playwright, 4 specs) |

---

## Principles the suite is built on

**A check that cannot fail proves nothing.** Probes assert the conditions they
depend on. If a probe cannot establish its subject — no reviewable booking, no
registerable tournament, nothing unread for the second player — it fails loudly
instead of passing vacuously. Several checks were rewritten after they were
found to be passing for the wrong reason.

**Fixtures are discovered, not hard-coded.** The `dev`/`test` profiles rebuild
H2 on every restart, so ids change between runs. Probes look up their subjects
at runtime.

**Failures are proved at the server, not in the source.** The regression matrix
re-runs the original reproduction for every historical defect and demands the
safe answer from a running system.

**Tests are not weakened to pass.** Where a fix changed behaviour, the test was
rewritten to assert the corrected meaning. For example, when the booking summary
was corrected from labelling the settled amount "Total due" to reporting *paid*
and *still due*, two component tests that encoded the old (wrong) semantics were
rewritten rather than deleted.

---

## Verified counts

From the most recent full run of `qa/run-qa.ps1` in this repository:

| Layer | Result |
|---|---|
| Backend unit + integration | **492 tests, 0 failures** |
| Frontend component | **127 tests across 24 files, 0 failures** |
| Lint | clean |
| Honesty scan | clean (14 reviewed exemptions allowlisted) |
| Production build | clean |
| Live API + role matrix | **140 checks passed, 0 failed** |
| Money lifecycle | passed |
| Data integrity | passed |
| API contract audit | **27 checks passed, 0 failed** |
| Regression matrix TC-001…TC-032 | **27 checks passed** |
| Adversarial break | **23 checks passed** |
| Multi-agent probe | passed |

Feature-flow probes, verified individually against a running system:

| Probe | Checks |
|---|---|
| `frontend/qa/review-flow.mjs` | 15 |
| `frontend/qa/notification-flow.mjs` | 16 |
| `frontend/qa/promo-flow.mjs` | 12 |
| `frontend/qa/open-games-flow.mjs` | 12 |
| `frontend/qa/amenities-flow.mjs` | 6 |

> **Browser stages.** These run against the **production preview** on `4173`
> (accessibility on `4175`), not the dev server. Re-run individually against a
> freshly seeded database, they gave:
>
> | Probe | Result |
> |---|---|
> | `a11y-audit.mjs` | no accessibility violations; no horizontal overflow at any viewport |
> | `consistency-audit.mjs` | **60 of 60 checks pass** |
> | `promo-flow.mjs` | 12 checks pass |
> | `notification-flow.mjs` | 16 checks pass |
> | `open-games-flow.mjs` | 12 checks pass |
> | `amenities-flow.mjs` | 6 checks pass |
> | `review-flow.mjs` | 10 pass, **2 fail** — see below |
> | `ui-crawl.mjs`, journeys, Playwright | **did not complete** in this run |
>
> The two `review-flow` failures are a **seed-data defect, not a review defect**:
> `VenueDataSeeder` makes the demo *player* account the owner of its venues, so
> `/owner/reviews` correctly returns 403 for it. The probe does not check the
> status and reports the refusal as "0 reviews". Both are recorded in
> [decisions.md](decisions.md#operational-limitations).
>
> An earlier run of `consistency-audit` reported 2 failures; those did not
> reproduce on a clean database and were cross-run data pollution from executing
> the probe twice against one long-lived H2 instance.

---

## Notable backend test coverage

| Area | What it proves |
|---|---|
| `BookingConcurrencyIntegrationTest` | Two players racing one slot — exactly one wins |
| `PaymentLifecycleIntegrationTest` | Refund equals what was taken, split by tender |
| `PromotionRedemptionTest` | Discount maths, caps, every refusal reason, and 12 concurrent redemptions of a limit-3 code granting exactly 3 |
| `PlayerNotificationLifecycleTest` | Notifications are written by the transition, deduplicated, scoped to their owner |
| `ReviewServiceTest` | Authorship comes from the token; ownership, timing and duplicate rules |
| `SecurityMatrixTest` | Role enforcement across the endpoint surface |
| `KnownVulnerabilityRegressionTest` | The original security findings stay fixed |
| `ApiContractRegressionTest` | Response shapes and status codes, including that a turf request keeps only what the owner supplied |

---

## Test data

Seeders (`@Profile({"dev","test","ci"})`) create venues, pitches, slots,
players, bookings, reviews, rewards, tournaments and payouts. `qa/seed-qa-dataset.ps1`
creates a deterministic dataset for manual exploration. Demo credentials are in
[setup.md](setup.md#demo-accounts).
