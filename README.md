<div align="center">
  <img src="https://github.com/SHOEBILL04/TurfChai/blob/main/frontend/public/icons.svg?text=TurfChai" alt="TurfChai Logo" width="120" height="120" />
  <h1>TurfChai</h1>
  <p><em>The ultimate full-stack platform for booking sports turfs, hosting tournaments, and organizing open pickup games in Dhaka, Bangladesh.</em></p>

  <!-- Badges -->
  <a href="#"><img src="https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 21" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Spring_Boot-4.1.0-6DB33F?style=for-the-badge&logo=spring&logoColor=white" alt="Spring Boot" /></a>
  <a href="#"><img src="https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" /></a>
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Render-Deployed-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render" /></a>
  <a href="https://turf-chai.vercel.app/"><img src="https://img.shields.io/badge/Vercel-Live_Demo-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel Live Demo" /></a>
</div>

---

> [!WARNING]
> **Active Development Phase:** This project is currently in the active building and development phase. Features, schemas, and UI components are actively being updated and might change rapidly.

---

## 📖 Overview

**TurfChai** is a modern, high-performance web application designed to connect sports enthusiasts with local venues. It bridges the gap between turf owners and players in Bangladesh, providing tailored experiences for three distinct user roles:

- 🏃‍♂️ **Players**: Search for venues using interactive maps (`leaflet`), book slots dynamically, join open games, split payments, and participate in tournaments.
- 🏢 **Venue Owners**: Manage pitch schedules, configure peak/off-peak pricing rules (`SportPricingRule`), scan QR codes for bookings, and track detailed financial revenue models (Payouts & GMV).
- 🛡️ **Administrators**: Review turf registrations, handle player dispute resolutions, oversee moderation, and manage payout disbursements using advanced backend analytics.

---

## 🛠️ Comprehensive Technology Stack

### Backend Architecture
- **Language**: Java 21 LTS
- **Framework**: Spring Boot 4.1.0 (REST APIs, Security, Data JPA)
- **Security**: JWT Authentication Pipeline + BCrypt Password Hashing + Role-Based Access Control (`PLAYER`, `SOLO_PLAYER`, `HOST`, `OWNER`, `ADMIN`, `SUPER_ADMIN`)
- **AI/LLM Module**: Custom lightweight `com.turfchai.ai` module powered by **OpenRouter LLMs** supporting Retrieval-Augmented Generation (RAG) and Tool Calling APIs (no bloated abstractions like LangChain/Spring AI).
- **Build Tool**: Apache Maven (`pom.xml`)

### Frontend Ecosystem
- **Framework**: React 19.2.0 + Vite 7
- **Routing**: React Router v7 (`react-router-dom`)
- **Visuals & Data**: Vanilla CSS with custom tokens, `chart.js` (financial metrics/KPIs), `leaflet` (map integration), `qrcode` (booking verification).
- **Server Communication**: Asynchronous custom hooks (`useApi.js`) wrapped around native `fetch`.

### Database & DevOps
- **Database**: PostgreSQL 16
- **Migrations**: Flyway `V1` -> `V8` (Strict, versioned schema management, optimistic locking).
- **Hosting / CI/CD**: Configured for continuous deployment on **Render.com** via Docker (`render.yaml`).
- **Frontend Hosting**: Automatically synced to Vercel via GitHub actions.

---

## 🧩 Core Database Schema Models

The PostgreSQL database (`turfchai`) revolves around the following primary entities:
1. `users` — Secure authentication and multi-role configurations.
2. `venues` & `pitches` — Hierarchical mapping of sports complexes and their individual playing fields.
3. `sports` & `sport_pricing_rules` — Granular configuration for games (e.g., Futsal vs. Cricket) and dynamic pricing.
4. `bookings` & `slots` — Slot engine relying on optimistic locking to prevent double-booking.
5. `tournaments` & `fixtures` — Comprehensive e-sports and physical sports tournament brackets and registrations.
6. `open_games` — Allow solo players to queue for and merge into community matches.

---

## 🚀 Quick Start (Local Development)

All teammates work locally. You must have **JDK 21**, **Node.js LTS**, and **PostgreSQL 16** installed on your system.

### 1. Database Setup
Start your local PostgreSQL service. Connect as superuser `postgres` and run:
```sql
CREATE ROLE turfchai LOGIN PASSWORD 'turfchai_dev';
CREATE DATABASE turfchai OWNER turfchai;
```
*(Note: Flyway will automatically execute migrations and build the full schema when the application boots).*

### 2. Backend Boot
Configure your environment by duplicating `.env.sample` into `.env` at the root if you need to override default credentials or provide an OpenRouter API key.
```bash
# Ensure JAVA_HOME points to Java 21
./mvnw clean compile
./mvnw spring-boot:run
```
> [!TIP]
> **API Health Check**: The backend API confirms readiness at `http://localhost:8080/api/v1/health`.

### 3. Frontend Boot
```bash
cd frontend
npm install
npm run dev
```
> [!TIP]
> **UI Access**: The application frontend is available at `http://localhost:5173`. Vite will automatically proxy `/api` calls to port `8080`.

---

## ☁️ Cloud Deployment (Render & Vercel)

The application utilizes Infrastructure as Code (IaC) via `render.yaml` for zero-downtime deployments.
- **Frontend Live Demo**: The frontend is continuously deployed to Vercel and can be accessed at **[https://turf-chai.vercel.app/](https://turf-chai.vercel.app/)**.
- **Backend API**: The `turfchai-backend` web service auto-deploys via a custom Docker container on Render.
- **Database**: Flyway migrations are securely run using the managed Render PostgreSQL `connectionString`.
- **Secrets**: Sensitive variables (like `JWT_SECRET`, `OPENROUTER_API_KEY`) are dynamically injected in production.

---

## 🧪 Testing and Verification

The backend utilizes an in-memory `H2` database during the test phase to completely prevent local Postgres pollution. Seeders are heavily isolated using `@Profile("test")`.

```bash
# Run all 154+ unit tests and verification checks
./mvnw -B -ntp verify
```

## 📄 License
Copyright © 2026 TurfChai. All rights reserved.
