# `qa/` — QA reproduction tooling

Standalone QA tooling. **Nothing here is application source**, and nothing here modifies application
source, configuration or migrations. Every script drives the project's own public REST API against
the supported `dev` profile, whose database is in-memory H2 — so a backend restart always gives a
clean, reproducible slate and no developer data is ever at risk.

## Scripts

| Script | Purpose | Output |
|---|---|---|
| `seed-qa-dataset.ps1` | Creates the deterministic QA dataset (accounts, bookings, venues, slots, tournament team, open game, promotion, rewards) | `baseline/qa-dataset.json` |
| `reproduce-findings.ps1` | Replays every reported finding + discovery probes at API level | `baseline/qa-findings-api.json` |
| `followup-probes.ps1` | Probes that needed corrected payloads or a third identity | `baseline/qa-findings-followup.json` |
| `decisive-proofs.ps1` | Forged-review persistence and venue-rating corruption proofs | `baseline/qa-findings-proofs.json` |
| `join-identity-proof.ps1` | Proves whether open-game join trusts the body `userId` | `baseline/qa-join-identity-proof.json` |
| `review-authorship-proof.ps1` | Proves review authorship comes from the JWT, not the body, on a freshly created booking | console only |
| `scan-dead-controls.ps1` | Independent source scan for toast-only / handler-less controls | `baseline/qa-dead-controls.json` |
| `build-baseline.ps1` | Consolidates everything into the master artifact | `baseline/qa-baseline.json` |

## Run order

```powershell
.\mvnw.cmd -o spring-boot:run "-Dspring-boot.run.profiles=dev"   # terminal 1 (fresh DB)
cd frontend; npm run dev                                          # terminal 2

powershell -NoProfile -ExecutionPolicy Bypass -File qa\seed-qa-dataset.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\reproduce-findings.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\followup-probes.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\decisive-proofs.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\join-identity-proof.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\scan-dead-controls.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\build-baseline.ps1
```

## Constraints

- Scripts must remain **UTF-8 with BOM**; Windows PowerShell 5.1 otherwise misreads the non-ASCII
  characters and fails to parse.
- Windows PowerShell 5.1 cannot use `if` as a positional argument — wrap it as `$(if (...) {...})`.
- The seeder is safe to re-run only against a **fresh** backend; re-running against a populated
  database will hit duplicate-email (409, handled) and already-booked-slot (409) paths.

## Read this first

`baseline/QA-BASELINE.md` — the human-readable baseline and handoff document.
`baseline/qa-baseline.json` — the machine-readable equivalent.

## After the security remediation

`SECURITY-REMEDIATION.md` (repo root) records what was fixed and how it was verified.

The `REPRODUCED` / `PARTIAL` labels printed by `reproduce-findings.ps1` are heuristics written
against the **pre-fix** behaviour, so they no longer reflect reality. Read the `actual` and
`evidence` fields in `baseline/qa-findings-api.json` — those carry the real status codes.
