# TurfChai — Free Deployment Guide

> **Single-service deployment.** One Spring Boot jar now serves **both** the
> REST API and the built React SPA. No Vercel, no CORS, no SPA rewrite rules —
> `/admin` and every other deep link work because there is only one origin.
> This is the fix for the previous split setup (Vercel frontend + Render
> backend) where visiting `/admin` 404'd or timed out.

Verified working before shipping this: `/`, `/admin`, `/admin/login`,
`/admin/turfs/42`, `/player/bookings/123` all return the SPA shell (200),
`/api/v1/**` routes to controllers, hashed assets cache `1y immutable`, admin
2FA login (challenge → code → JWT → `/api/v1/admin/admins`) works same-origin,
and unknown API routes still return 401.

---

## Total cost: $0

| Piece      | Service       | Free tier                                                                 | Catch                                       |
| ---------- | ------------- | ------------------------------------------------------------------------- | ------------------------------------------- |
| App + web  | Render        | 750 hrs/mo, 512 MB RAM, sleeps after ~15 min idle (~50s wake)             | cold start on first visit                   |
| Database   | Neon          | 0.5 GB storage, autosuspend ~5 min (wakes in <1 s)                          | none that matter for a demo                 |
| Domain     | GitHub Student Pack | free `.me` (Namecheap) or `.tech` domain for 1 year                  | renewal after the year (~$10-20)            |

Free alternatives: **Koyeb** (one web service, 512 MB — set `JAVA_OPTS` to cap
heap) for the app, **Supabase** for Postgres (pauses after 1 week idle), and
**eu.org** for a free-forever subdomain (approval takes weeks).

**Avoid Render's own free Postgres** — it expires after 30 days.

---

## Why `/admin` broke before (and can't now)

1. **No SPA fallback on Vercel** — `/admin` asked for a literal file that
   didn't exist → 404. The jar's `SpaConfig` now serves `index.html` for any
   extensionless client route.
2. **Security config** — `anyRequest().authenticated()` would have 401'd the
   anonymous `/admin` visit. Client-route prefixes are now `permitAll` (the
   page itself is public; guards inside the SPA redirect to login).
3. **API base URL** — with `VITE_API_BASE_URL` unset, the client uses relative
   `/api/v1` — same origin as the page, so it just works.
4. **CORS** — same-origin requests never trigger CORS. `FRONTEND_URL` only
   matters again if you deploy the frontend separately.
5. **Cold starts** — still real on Render free (see "Keeping it awake").

---

## Deploy on Render (Docker, ~10 minutes)

### 1. Database — Neon

1. Sign up at <https://neon.tech> (free, no card) → create project `turfchai`.
2. Dashboard → **Connection string** → copy the pooled connection string
   (it ends `?sslmode=require`, host looks like `ep-xxx-pooler...`).

> Use the **pooled** string: it caps concurrent connections (HikariCP opens
> up to 10) inside Neon's free connection limit.

### 2. Web service — Render

1. Push the repo to GitHub.
2. Render → **New → Web Service** → connect the repo.
3. Settings:
   - **Runtime:** Docker (uses the root `Dockerfile`, which builds the
     frontend and backend into one image from a clean checkout)
   - **Instance type:** Free
   - **Health check path:** `/api/v1/health`
4. Environment variables (Render dashboard → Environment):

   | Key                              | Value                                             |
   | -------------------------------- | ------------------------------------------------ |      |
   | `SPRING_DATASOURCE_URL`          | `jdbc:postgresql://<neon-pooler-host>/neondb?sslmode=require` |
   | `SPRING_DATASOURCE_USERNAME`     | your Neon user                                   |
   | `SPRING_DATASOURCE_PASSWORD`     | your Neon password                               |
   | `JWT_SECRET`                     | long random string (≥ 32 chars)                  |
   | `OTP_EXPOSE_DEV_CODE`            | `true` for demo (login code shown in UI), `false` + SMTP for real 2FA |

   Leave `SPRING_PROFILES_ACTIVE` unset or `prod` — seeders do not run for
   `prod`, so the first admin must be created via a migration or a temporary
   `docker` profile boot (see "First admin on a fresh database" below).

5. Deploy. First build ~5–8 min (Maven layer caches afterwards). The service
   URL `https://<name>.onrender.com` serves everything:
   - `https://<name>.onrender.com/` — the app
   - `https://<name>.onrender.com/admin` — admin console (works now)
   - `https://<name>.onrender.com/api/v1/health`

### 3. First admin on a fresh database

The `prod` profile doesn't run `AdminDataSeeder` (it's dev/test/ci/docker
only). V4/V24 migrations already insert a super admin with a known password
hash, so on a brand-new database sign in with:

- Email: `shahadat.cse.20230104008@aust.edu`
- Password: `TurfChai@123`
- 2FA code: with `OTP_EXPOSE_DEV_CODE=true` the code is displayed on the
  login screen (`devCode`) — no SMTP needed for a demo.

**Change this password before sharing the URL publicly**, or set
`OTP_EXPOSE_DEV_CODE=false` + real SMTP credentials.

### 4. Custom domain (optional — student pack)

1. Claim your free domain: GitHub Student Pack → Namecheap `.me` (or
   get.tech `.tech`) — free for 1 year.
2. Render → your service → **Settings → Custom domains** → add
   `www.yourdomain.me` (and the apex `yourdomain.me`).
3. At Namecheap, add the CNAME record Render shows you (for the apex, follow
   Render's redirect/ALIAS instructions).
4. Wait for DNS (minutes to a few hours). Render issues Let's Encrypt SSL
   automatically.

No backend env changes needed — same-origin means no CORS to reconfigure;
the JWT/bookings URLs all derive from the request origin.

---

## Keeping it awake (Render free cold starts)

The free instance sleeps after ~15 min idle and takes ~50 s to wake, during
which the site looks down. Options:

- **Do nothing** — fine for a demo; the first visitor waits once.
- **Cron ping (free):** [cron-job.org](https://cron-job.org) or
  [UptimeRobot](https://uptimerobot.com) hitting
  `https://<name>.onrender.com/api/v1/health` every 10 min.

  ⚠️ Render counts those hours: 24/7 uptime ≈ 730 hrs vs the 750 free
  hours — one service stays within free, but you can't keep two services
  awake.

- **The honest fix:** Oracle Cloud Always Free VM (4 ARM cores, 24 GB RAM,
  free forever, never sleeps) — run `docker compose up --build -d` there and
  point the domain at the VM's IP. Everything in this repo works there
  unchanged; see `docker-compose.yml` (the default `app` service is the same
  single-service image).

---

## What's deployed where (quick reference)

```
Browser ──▶ https://<name>.onrender.com
             │
             ├── /api/v1/**, /v3/**, /swagger-ui/**, /actuator/**  → controllers (JWT-gated)
             ├── /assets/**                                        → hashed, immutable, 1y cache
             ├── /ai-chat.html, /favicon.svg, /icons.svg           → static files
             └── /, /admin/**, /player/**, /solo/**, /host/**,
                /owner/**, /auth/**                                → SPA shell → React Router
                                                                    (guards redirect to login)
```

- SPA fallback: `src/main/java/com/turfchai/config/SpaConfig.java`
- Route permissions: `src/main/java/com/turfchai/config/SecurityConfig.java`
- Regression guard: `src/test/java/com/turfchai/config/SpaFallbackTest.java`
- Image build: root `Dockerfile` (Node build → Maven package → JRE runtime)
- Render blueprint: `render.yaml`

---

## Local production check (no cloud needed)

```powershell
# build + run exactly what the cloud runs (needs Docker, or):
.\mvnw.cmd clean package -DskipTests        # after: cd frontend && npm run build
Copy-Item -Recurse -Force frontend\dist\* src\main\resources\static\
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev   # dev = H2, no Postgres
# open http://localhost:8080/admin — the deployed behaviour, locally
# (the copied bundle is git-ignored; do not commit it)
```

`docker compose up --build` gives the same single-service image against local
Postgres; `docker compose --profile split up --build` still provides the
legacy nginx-on-5173 frontend for CORS testing.

---

## Optional integrations (all free tiers)

| Feature        | Env var(s)                                  | Without it                        |
| -------------- | ------------------------------------------- | --------------------------------- |
| AI assistant   | `OPENROUTER_API_KEY` (openrouter.ai/keys)   | chat answers 503 honestly         |
| AI fallback    | `HF_API_KEY` (huggingface.co token)          | OpenRouter-only                  |
| Real 2FA email | `SPRING_MAIL_*` (Gmail app password works)  | code shown in UI (devCode)       |
| Image upload   | `CLOUDINARY_URL`                            | uploads rejected honestly        |
|                | (student pack: DigitalOcean credit also covers a droplet if you outgrow free Render) | |
