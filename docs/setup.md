# TurfChai — Local Setup

## Prerequisites

| Tool       | Version       | Notes                                                                                       |
| ---------- | ------------- | ------------------------------------------------------------------------------------------- |
| JDK        | 21            | `pom.xml` sets `<java.version>21</java.version>`                                            |
| Node.js    | LTS (20+)     | Vite 7 requires a modern Node                                                               |
| PostgreSQL | 16            | **Only for the default profile.** The `dev` profile uses in-memory H2 and needs no database |
| PowerShell | 5.1 or `pwsh` | Only to run the QA gate                                                                     |

Maven is not required — use the bundled wrapper (`./mvnw`, `mvnw.cmd`).

---

## Fastest path — no database needed

The `dev` profile runs on in-memory H2 with demo seed data, so the whole product
is usable within a minute of cloning.

```bash
# terminal 1 — backend on :8080
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# terminal 2 — frontend on :5173
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to port 8080.

> The H2 database is rebuilt on every restart, so ids change between runs. This
> is why the tests and QA probes discover their subjects at runtime rather than
> hard-coding ids.

### Demo accounts

Seeded by the `@Profile({"dev","test","ci"})` seeders:

| Role                           | Email                                         | Password     |
| ------------------------------ | --------------------------------------------- | ------------ |
| Player                         | `rafi@turfchai.dev`                           | `demo1234`   |
| Other players / owners / hosts | see `/admin/users`                            | `Demo@12345` |
| Admin (2FA)                    | `admin0@turfchai.com` … `admin3@turfchai.com` | `Demo@12345` |

Admin sign-in is two-step. In `dev` the one-time code is returned in the
challenge response as `devCode` (`OTP_EXPOSE_DEV_CODE=true`), so no mail server
is needed.

---

## Full path — PostgreSQL

```sql
CREATE ROLE turfchai LOGIN PASSWORD 'turfchai_dev';
CREATE DATABASE turfchai OWNER turfchai;
```

Copy `.env.example` to `.env` and adjust. Then:

```bash
./mvnw clean compile
./mvnw spring-boot:run
```

Flyway applies all 34 migrations on boot.

---

## Environment configuration

`.env.example` is the template; `.env` is gitignored and must never be
committed. Every variable has a working local default except the optional
integrations.

| Variable                                              | Purpose                               | Required                              | Example                                     |
| ----------------------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------------- |
| `SPRING_DATASOURCE_URL`                               | JDBC URL                              | no (defaults to local Postgres)       | `jdbc:postgresql://localhost:5432/turfchai` |
| `SPRING_DATASOURCE_USERNAME`                          | DB user                               | no                                    | `turfchai`                                  |
| `SPRING_DATASOURCE_PASSWORD`                          | DB password                           | no                                    | _(set locally)_                             |
| `SPRING_DATASOURCE_DRIVER`                            | JDBC driver                           | no                                    | `org.postgresql.Driver`                     |
| `SPRING_JPA_DATABASE_PLATFORM`                        | Hibernate dialect                     | no                                    | `org.hibernate.dialect.PostgreSQLDialect`   |
| `SPRING_JPA_HIBERNATE_DDL_AUTO`                       | Schema strategy                       | no                                    | `validate`                                  |
| `JWT_SECRET`                                          | Signing key                           | **yes in production**                 | a long random string                        |
| `JWT_ISSUER`                                          | Token issuer                          | no                                    | `turfchai`                                  |
| `JWT_EXPIRATION_MS`                                   | Access-token lifetime                 | no                                    | `86400000`                                  |
| `JWT_REFRESH_EXPIRATION_MS`                           | Refresh-token lifetime                | no                                    | `604800000`                                 |
| `OTP_TTL_SECONDS`                                     | One-time-code lifetime                | no                                    | `300`                                       |
| `OTP_EXPOSE_DEV_CODE`                                 | Return the code in the API response   | no — **dev/demo only**                | `true`                                      |
| `SPRING_MAIL_HOST` / `PORT` / `USERNAME` / `PASSWORD` | SMTP for codes and notification email | no — skipped when unset               | —                                           |
| `OPENROUTER_API_KEY`                                  | AI assistant                          | no — falls back without it            | —                                           |
| `HF_API_KEY`                                          | Hugging Face (optional model access)  | no                                    | —                                           |
| `CLOUDINARY_URL`                                      | Image uploads                         | no — uploads fail honestly without it | `cloudinary://key:secret@cloud`             |
| `PORT`                                                | Backend port                          | no                                    | `8080`                                      |
| `FRONTEND_URL`                                        | CORS origin                           | no                                    | `http://localhost:5173`                     |

Never commit real values. `OTP_EXPOSE_DEV_CODE` must be `false` in production.

---

## Running the tests

One command runs everything — backend, frontend, live API and browser:

```powershell
pwsh qa/run-qa.ps1                # full gate
pwsh qa/run-qa.ps1 -Quick         # static stages only, no servers
pwsh qa/run-qa.ps1 -SkipE2E       # everything except the browser suite
pwsh qa/run-qa.ps1 -KeepServers   # leave the servers running afterwards
```

It starts anything not already running, stops only what it started, prints a
pass/fail line per stage and exits non-zero on any failure.

Individual layers:

```bash
./mvnw test                       # backend
cd frontend && npx vitest run     # component tests
cd frontend && npm run lint       # ESLint
cd frontend && npm run build      # production build
cd frontend && npx playwright test # browser suite
```

See [testing.md](testing.md) for what each layer proves.

---

## Building

```bash
./mvnw clean package              # backend jar → target/turfchai-0.0.1-SNAPSHOT.jar
cd frontend && npm run build      # frontend → frontend/dist
```

---

## Troubleshooting

| Symptom                                      | Cause                                                        | Fix                                                       |
| -------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Backend starts but every API call 401s       | No token, or the token expired                               | Sign in again; the client clears the session on 401       |
| `Unresolved compilation problems` from Maven | An IDE wrote stale `.class` files into `target/test-classes` | `./mvnw clean test`                                       |
| Admin login says too many attempts           | 5 challenges per 15 minutes per admin                        | Wait, or use a different `admin0..3` account              |
| Ids in the docs do not match your database   | `dev` rebuilds H2 on every restart                           | Discover ids at runtime; do not hard-code them            |
| Pricing quote returns 503                    | ONNX model unavailable                                       | Expected — booking still works at the slot's stored price |
| Photo upload fails                           | `CLOUDINARY_URL` not set                                     | Expected — the app refuses rather than inventing a URL    |
| `mvnw clean` breaks a running server         | It wipes `target/classes` under the live JVM                 | Stop the server first                                     |
