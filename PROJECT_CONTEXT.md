# TurfChai Project Context & Current State

This document provides a complete technical summary of the **TurfChai** project. You can copy and paste this context to any AI assistant to immediately bring it up to speed on the current state of the repository.

---

## 1. Project Overview

* **Name**: TurfChai
* **Purpose**: A full-stack web application designed for sports enthusiasts in Dhaka, Bangladesh to search and book sports turfs/venues, join solo/open pickup games, and host/participate in sports tournaments.
* **Target User Roles**:
  1. `PLAYER`: Browse venues, book slots, join open games, split payments, track stats.
  2. `OWNER`: Manage venues, set pitch schedules, configure peak/off-peak pricing rules, view revenue reports.
  3. `ADMIN`: Review turf registration applications, monitor disputes, manage payouts.

---

## 2. Technology Stack

### Backend
* **Language & Framework**: Java 21, Spring Boot 4.1.0
* **Security & Auth**: Spring Security (JWT authentication pipeline)
* **Database & ORM**: PostgreSQL, Spring Data JPA / Hibernate 7
* **Database Migrations**: Flyway (`src/main/resources/db/migration/`)
* **AI Orchestrator**: Custom decoupled module (`com.turfchai.ai`) supporting OpenRouter LLMs with RAG (Retrieval-Augmented Generation) & Tool Calling (no heavy external frameworks like Spring AI or LangChain)
* **Build Tool**: Apache Maven (`./mvnw`)

### Frontend
* **Framework**: React 18 / Vite 7
* **Routing**: React Router v6
* **Styling**: Vanilla CSS (custom design tokens and utility classes)
* **API Proxy**: Vite dev server proxies `/api` requests to `http://localhost:8080`

---

## 3. Database & Schema Details

* **Database Name**: `turfchai` (PostgreSQL running on `localhost:5432`)
* **Credentials**: User `postgres`, Password `postgres`
* **Authoritative Schema Files**:
  * `V1__baseline.sql`: Primary database schema (tables: `users`, `venues`, `pitches`, `sports`, `sport_pricing_rules`, `open_games`, `tournaments`, `tournament_teams`, `tournament_fixtures`, `tournament_pitch_reservations`, etc.).
  * `V2__seed_demo_users.sql`: User migration file (cleared / disabled for empty DB state).
  * `V3__player_platform_alignment.sql`: Platform schema alignment updates.

### Key Entity Alignments:
* `User.java`: Field `reliabilityScore` is mapped to database column `reliability_score` (`INTEGER`).
* `Sport.java`: Field `active` maps to column `is_active`.
* `SportPricingRule.java`: Field `active` maps to column `is_active`.

---

## 4. Current Application State

1. **Database & Schema Status**:
   * PostgreSQL database `turfchai` is created and initialized.
   * All Flyway schema migrations (V1, V2, V3) execute cleanly.
   * **Demo Data Clean-up**: All demo data in PostgreSQL has been removed. Tables currently contain **0 records** for clean deployment/testing.
   * **Test Seeders Scoped**: Seeder classes (`PlayerDataSeeder`, `VenueDataSeeder`, `TournamentDataSeeder`) use `@Profile("test")` so that unit tests pass using in-memory H2, while keeping the main PostgreSQL database completely empty.

2. **Build & Test Verification**:
   * **Compilation**: `./mvnw clean test-compile` passes with `BUILD SUCCESS`.
   * **Unit Tests**: `./mvnw test` passes **154 out of 154 unit tests** (`BUILD SUCCESS`).
   * **Frontend Fallbacks**: Static mock arrays in `frontend/src/data/` (`venues.js`, `games.js`, `bookings.js`, `tournaments.js`, `users.js`, `admin.js`, `notifications.js`) are cleared to empty arrays.

3. **Running the Project locally**:
   * **Backend**: Free port `8080` and run `./mvnw spring-boot:run`. API health check available at `http://localhost:8080/api/v1/health`.
   * **Frontend**: Navigate to `frontend/` directory and run `npm run dev`. Accessible at `http://localhost:5173`.

---

## 5. Key Architecture & File Map

```
TurfChai/
├── src/main/java/com/turfchai/
│   ├── TurfchaiApplication.java       # Spring Boot main entry point
│   ├── controller/                    # General API Controllers (Auth, Health, OpenGames)
│   ├── player/                        # Player profile & saved venues module
│   │   ├── api/                       # UserProfileRestController
│   │   ├── config/                    # PlayerDataSeeder (test profile)
│   │   └── service/                   # UserProfileService
│   ├── venue/                         # Venues, Pitches, and Pricing Rules module
│   │   ├── api/                       # VenueRestController
│   │   ├── entity/                    # Venue, Pitch, Sport, SportPricingRule
│   │   └── repository/                # JPA Repositories for venues & sports
│   ├── tournament/                    # Tournament hosting & fixture generation
│   ├── model/                         # Core entities (User, BaseEntity) and enums
│   └── ai/                            # Decoupled AI chatbot agent (OpenRouter LLM + RAG + Tools)
├── src/main/resources/
│   ├── application.properties         # PostgreSQL datasource & Flyway settings
│   ├── application-dev.properties     # Dev profile settings
│   ├── db/migration/                  # V1__baseline.sql, V2__seed_demo_users.sql, V3__player_platform_alignment.sql
│   ├── prompts/                       # AI system, safety, role, and RAG markdown prompts
│   └── ai-knowledge/                  # Vector knowledge chunks for policy RAG
└── frontend/
    ├── vite.config.js                 # Vite config with API proxy to port 8080
    ├── src/
    │   ├── api/                       # REST client calls (venues, players, auth)
    │   ├── data/                      # Frontend data exports (cleared for real API usage)
    │   ├── layouts/                   # PlayerLayout, OwnerLayout, AdminLayout
    │   └── pages/                     # Views for Home, Explore, Venue, Matchday, Owner Dashboard
```

---

## 6. Prompt to Copy/Paste for any AI

```text
Project Context:
TurfChai is a full-stack Spring Boot 4.1 (Java 21) and React (Vite 7) web application for sports venue booking in Dhaka. The database is PostgreSQL (`turfchai`) with Flyway migrations (`V1` to `V3`). All 154 backend unit tests pass (`./mvnw test` BUILD SUCCESS). Demo data in PostgreSQL and frontend data files has been cleared so the database is clean. Seeders run only under the `test` profile for unit tests. The backend runs on port 8080 (`./mvnw spring-boot:run`) and the frontend dev server runs on port 5173 (`npm run dev`).
```
