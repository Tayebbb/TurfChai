# Security Remediation Report

Scope: authentication, authorization, identity, tenant isolation, impersonation, PII exposure and
privilege escalation. Every claim below is backed by an automated test or a live probe recorded in
`qa/baseline/`.

**Status: all targeted vulnerabilities fail safely.**

| Gate | Result |
|---|---|
| Backend test suite | 332 tests, 0 failures, 0 errors |
| Security regression matrix (`SecurityMatrixTest`) | 16/16 pass |
| Frontend lint (`npx eslint .`) | 0 problems |
| Frontend build (`npm run build`) | success |
| Original exploits replayed | all denied |
| Browser auth flows | verified signed-out, signed-in, wrong-role |

---

## 1. Root causes

Three patterns produced almost every finding.

1. **Caller-supplied identity.** Handlers read `X-User-Id` headers or `userId` / `organizerUserId`
   body fields and trusted them. Anyone could act as anyone by editing a request.
2. **Demo fallbacks in production paths.** When no principal was present, code substituted a
   constant (`DEMO_USER_ID`, `1L`, `owner@turfchai.com`) instead of refusing. Anonymous callers
   silently became a real user.
3. **Allow-by-default routing.** `SecurityConfig` permitted whole namespaces, so authorization
   depended on each handler remembering to check — and several did not.

## 2. Backend changes

### Deny by default
`config/SecurityConfig.java` was rewritten. The chain now ends in `.anyRequest().authenticated()`
and every public route is enumerated **by method and path**:

- auth endpoints (register, login, refresh, OTP, admin login, email check)
- health / error
- read-only catalogue: `GET /venues`, `/venues/explore`, `/venues/*`, `/venues/*/slots`
- read-only solo feed: `GET /solo/open-games`, `/solo/open-games/*`, `/*/members`
- reward catalogue, promo-code validation, the public chat endpoint

Everything else requires a session. `/api/v1/admin/**` requires ADMIN or SUPER_ADMIN,
`/api/v1/owner/**` requires OWNER/ADMIN/SUPER_ADMIN, `GET /api/ai/metrics` and the OpenAPI/Swagger
routes are admin-only.

### One way to learn who the caller is
New `security/AuthenticatedUser` is the only path from a principal to an id. It throws the new
`UnauthenticatedException` (mapped to 401 in `GlobalExceptionHandler`) rather than defaulting.
Every handler that needs identity now goes through it, so "no principal" can no longer degrade into
"some principal".

### Handlers hardened

| Area | Change |
|---|---|
| `player/api/UserProfileRestController` | `X-User-Id` and `DEMO_USER_ID` removed; identity from JWT |
| `tournament/api/TournamentRestController` | `X-User-Id` removed; **every** endpoint calls `requireHostOf` |
| `tournament/service/TournamentService` | new `assertHost` — non-hosts get 403 |
| `tournament/api/PlayerTournamentRestController` | `X-User-Id` removed |
| `service/ReviewService` | author taken from principal; booking ownership enforced; cancelled and not-yet-started bookings rejected; duplicate key is `(booking, author)` |
| `controller/ReviewRestController` | staff status derived from granted authorities, not a request flag |
| `service/impl/OpenGameServiceImpl` | body `userId` / `organizerUserId` ignored; caller is the actor |
| `venue/api/OwnerVenueRestController` | seven `principal != null ? … : 1L` fallbacks removed |
| `payment/api/OwnerPaymentRestController` | `1L` fallback removed |
| `controller/OwnerTurfRequestRestController` | default owner identity removed |
| `media/api/MediaUploadRestController` | ownership checks no longer skipped when principal is null |

### PII containment
`ReviewRestController` returned the `Review` JPA entity, dragging `Booking → Slot` lazy proxies into
the serializer. That both produced a 500 **and** exposed unrelated data. New
`dto/response/ReviewResponse` is a flat projection. Password hashes and 2FA secrets were verified
non-serialisable by `SecurityMatrixTest.secretsAreNeverSerialised`.

## 3. Frontend changes

The API is authoritative, but the client was leaking identity on its own.

- **`api/client.js`** — stopped sending the `X-User-Id` header entirely.
- **`api/players.js`** — `getMyProfile()` had a fallback that synthesised a profile from
  `localStorage` when the call failed, and rewrote the name when the server returned the demo user.
  That fabricated an identity and hid 401s. Removed; the call now simply fails.
- **`api/openGames.js` / `solo/GameDetailPage.jsx`** — no longer send a client-chosen `userId`.
- **`guards/RequireAuth.jsx`** (new) — validates the stored token against `GET /me` and checks the
  role **the server reports**, so a forged `localStorage` session cannot open a workspace. Optional
  `roles` prop; anonymous users go to `/auth?next=…`, wrong-role users to `/player`.
- **`routes/AppRoutes.jsx`** — previously only `/admin` was guarded. Now `/owner/**` requires an
  owner role, `/host/**` and all identity-bearing player/solo routes require a session. Public
  browsing (home, explore, venue detail, tournament detail, open games, checkout) stays open,
  matching the endpoints the backend serves anonymously.
- **`layouts/PlayerLayout.jsx`**, **`pages/player/HomePage.jsx`**, **`VenuePage.jsx`**,
  **`TournamentDetailPage.jsx`** — caller-scoped fetches are gated on a real session, and the shell
  renders "Guest" / `·` instead of a borrowed name.
- **`host/TournamentPage.jsx`** — a 401/403/404 rendered a fully-populated sample workspace
  including a named venue contact and "private to you" notes. It now renders an explicit denial.

## 4. Verification

### Automated
`src/test/java/com/turfchai/security/SecurityMatrixTest.java` — 16 tests using **real JWTs through
the real filter chain** (no mocked principals), covering: anonymous rejection, header-identity
spoofing, public-route preservation, malformed tokens, cross-role namespace access, admin vs
super-admin separation, role escalation via self-registration, cross-owner isolation, cross-user
booking reads, non-host tournament operations, secret serialisation, profile scoping and route
enumeration. Plus 9 new security regressions in `ReviewServiceTest`.

### Live exploit replay
The Phase-2 QA scripts were re-run against the rebuilt backend.

| Finding | Before | After |
|---|---|---|
| TC-001 profile read/tamper via `X-User-Id` | 200 + PII + write | **401** on all six probes; `piiLeaked=false`, `profileTampered=false` |
| TC-002 anonymous tournament read/write/destructive | 200 | **401** on all seven probes |
| TC-005 review submit | 500, row written anyway | **200** with the clean DTO |
| TC-006 check-in without ownership | succeeded | **403**; cancelled booking **400** |
| TC-007 forged review author | accepted | foreign booking **403**, body `userId` ignored |
| QA-N04 cross-owner venue access | — | read/update/promotions/unblock all **403** |
| QA-N06 open-game join as another user | victim enrolled | **caller enrolled** (`join-identity-proof.ps1`) |
| QA-N09 AI metrics + session delete | public | **401** |

`qa/review-authorship-proof.ps1` (new) creates two fresh accounts and a real booking, then proves:
attacker cannot review a foreign booking (403), the body `userId` is ignored on a legitimate
review (200, authored by the caller), and the attacker stays denied afterwards (403).

### Browser
- Signed out `/player`: heading is "Salam" with no name, avatar `·`, no notifications, "Sign in to
  see your next match". The pre-fix "Salam, Rafiul" / "RK" leak is gone.
- Anonymous `/owner`, `/player/bookings`, `/host/tournament` → redirect to `/auth?next=…`.
- Signed-in PLAYER at `/owner` → redirected to `/player`; at `/host/tournament` → explicit denial.
- Signed-in OWNER at `/owner` → own venue and own bookings only.
- Sign-in honours `?next=` and lands on the originally requested page.

## 5. Not addressed (outside this mandate)

These were observed but are not authentication/authorization defects:

- **TC-009** slots whose start time has passed can still be held and booked.
- **TC-010** payment is simulated — no gateway, no verification.
- **QA-N01/N02/N03** seeder defects: `AdminPartBDataSeeder` never runs; registering as OWNER
  auto-creates a venue; the ten demo venues belong to a PLAYER-role user.
- **QA-N07** slot rows are materialised on demand for arbitrary dates.
- **QA-N11** owner booking approve/cancel endpoints have no frontend consumer.
- Admin controllers still return JPA entities. Secrets are `@JsonIgnore`-protected (verified), but
  response DTOs would be a cleaner boundary.

## 6. Reproducing

```powershell
.\mvnw.cmd -o test                                                   # 332 tests
.\mvnw.cmd -o test "-Dtest=SecurityMatrixTest"                       # 16 security tests
cd frontend; npx eslint .; npm run build

.\mvnw.cmd -o spring-boot:run "-Dspring-boot.run.profiles=dev"       # fresh in-memory H2
powershell -NoProfile -ExecutionPolicy Bypass -File qa\seed-qa-dataset.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\reproduce-findings.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\join-identity-proof.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File qa\review-authorship-proof.ps1
```

> The status labels printed by `reproduce-findings.ps1` (`REPRODUCED`, `PARTIAL`) are heuristics
> written against the **pre-fix** behaviour and are now stale. Read the `actual` and `evidence`
> fields in `qa/baseline/qa-findings-api.json` — those carry the real status codes.
