# TurfChai — Project Context

A short, accurate briefing for anyone (or any AI assistant) joining the project.
Everything below is stated from the current repository. The detailed material
lives in [docs/](docs/).

---

## What it is

TurfChai is a full-stack sports-turf booking platform for Dhaka. Four roles use
it: **players** (discover, hold, book, pay, review, join open games, enter
tournaments), **venue owners** (venues, pitches, slots, pricing, promotions,
bookings, ledger), **tournament hosts** (multi-pitch reservation, registrations,
knockout bracket) and **administrators** (verification, moderation, payouts,
audit — behind two-factor sign-in).

Scale: **145 REST endpoints** across 38 controllers, **30 JPA entities**,
**34 Flyway migrations**, **71 frontend routes**.

## Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 4.1.0, Spring Security (JWT), Spring Data JPA / Hibernate 7, Maven wrapper |
| Frontend | React 19.2, Vite 7, React Router 7, vanilla CSS with design tokens |
| Database | PostgreSQL 16 + Flyway in production; in-memory H2 for `dev` and `test` |
| Optional | ONNX Runtime (pricing model), OpenRouter (AI assistant), Cloudinary (images), SMTP |
| Tests | JUnit 5 + Mockito + Spring Boot Test, Vitest + Testing Library, Playwright, live API probes |

## Running it

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # :8080, H2 + demo data
cd frontend && npm install && npm run dev               # :5173
```

The `dev` and `test` profiles use in-memory H2 with `flyway.enabled=false` and
`ddl-auto=update`, so **the database is rebuilt on every restart and seeded ids
change between runs**. PostgreSQL + Flyway is the production path.

Demo sign-in: `rafi@turfchai.dev` / `demo1234`. Other seeded accounts use
`Demo@12345`. See [docs/setup.md](docs/setup.md).

## Verified state

Most recent full run of `pwsh qa/run-qa.ps1`:

- **492** backend tests, 0 failures
- **127** frontend component tests across 24 files
- **140** live role-matrix checks, 0 failures
- **27** API contract checks, **27** regression checks, **23** adversarial checks
- Lint, honesty scan and production build clean

See [docs/testing.md](docs/testing.md) for what each layer proves, including the
stages that did not complete in that run.

## Things worth knowing before you change anything

- **Payments are recorded, not collected.** There is no gateway integration and
  the UI never implies one. Money settles at the venue.
- **Identity comes from the JWT, never from a request body.**
- **A resource you may not see returns 404, not 403.**
- **Contended rows are pessimistically locked** — slots, promo codes, open-game
  capacity — and there are tests that race real transactions.
- **Honesty is a build gate.** `frontend/scan-honesty.mjs` fails the build if a
  `catch` swallows a failure and reports success. Controls that cannot work are
  disabled with a stated reason rather than faked.
- **Historical Flyway migrations are never edited.** Some columns
  (`allow_split_payment`, `bank_accounts`, `booking_members`) survive features
  that were removed; nothing reads them.
- **The backend has two package styles** — feature packages (`booking`,
  `venue`, `payment`, …) and older layer packages (`controller`, `service`,
  `repository`). Both are live; check both.

## Where to read next

| Question | Document |
|---|---|
| What can it do? | [docs/features.md](docs/features.md) |
| How is it built? | [docs/architecture.md](docs/architecture.md) |
| What are the tables? | [docs/database.md](docs/database.md) |
| What are the endpoints? | [docs/api.md](docs/api.md) |
| How does a booking actually flow? | [docs/user-flows.md](docs/user-flows.md) |
| How do I run it? | [docs/setup.md](docs/setup.md) |
| How do I test it? | [docs/testing.md](docs/testing.md) · [TESTING.md](TESTING.md) |
| Why is it built this way, and what is missing? | [docs/decisions.md](docs/decisions.md) |
