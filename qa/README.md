# `qa/` — live QA tooling

Standalone QA tooling. **Nothing here is application source**, and nothing here modifies application
source, configuration or migrations. Every script drives the project's own public REST API against
the supported `dev` profile, whose database is in-memory H2 — so a backend restart always gives a
clean, reproducible slate and no developer data is ever at risk.

## One command

```powershell
pwsh qa/run-qa.ps1              # full gate: backend, frontend, live API, browser
pwsh qa/run-qa.ps1 -Quick       # static stages only (no servers needed)
pwsh qa/run-qa.ps1 -SkipE2E     # everything except the browser suite
pwsh qa/run-qa.ps1 -KeepServers # leave the servers running afterwards
```

`run-qa.ps1` starts anything that is not already running, runs every stage, stops only the servers it
started, prints a pass/fail line per stage and exits non-zero if any stage fails.
See [../TESTING.md](../TESTING.md) for the per-layer commands and counts.

## Stages driven by `run-qa.ps1`

| Script | Purpose |
|---|---|
| `qa-all-roles.ps1` | Every endpoint against every role — the authorization matrix |
| `verify-money-lifecycle.ps1` | Booking → payment → refund, by tender, against the ledger |
| `verify-data-integrity.ps1` | Cross-table invariants after real writes |
| `api-audit.ps1` | Response-contract audit (no entity internals, no leaked identifiers) |
| `rc-tc-verify.ps1` | Re-verifies every historical defect TC-001..TC-032 |
| `adversarial-break.ps1` | Hostile input, tampered identity, forced state transitions |
| `multi-agent-probe.ps1` | Concurrent actors competing for the same resources |

The browser stages (route crawl, journeys, flow probes, accessibility, Playwright) live in
[`../frontend/qa/`](../frontend/qa) and [`../frontend/e2e/`](../frontend/e2e); `run-qa.ps1` invokes
them directly.

## Standalone helpers

| Script | Purpose |
|---|---|
| `seed-qa-dataset.ps1` | Creates a deterministic QA dataset (accounts, bookings, venues, slots, tournament team, open game, promotion, rewards) |
| `scan-dead-controls.ps1` | Source scan for toast-only / handler-less controls |
| `scan-fake-handlers.ps1` | Source scan for handlers that report success without calling the server |
| `audit-orphans.ps1`, `audit-dead-modules.ps1`, `audit-connectivity.ps1` | Source scans for orphaned modules and unreachable surfaces |

## Constraints

- Scripts must remain **UTF-8 with BOM**; Windows PowerShell 5.1 otherwise misreads the non-ASCII
  characters and fails to parse.
- Windows PowerShell 5.1 cannot use `if` as a positional argument — wrap it as `$(if (...) {...})`.
