<div align="center">
  <img src="https://via.placeholder.com/150?text=TurfChai" alt="TurfChai Logo" width="120" height="120" />
  <h1>TurfChai</h1>
  <p><em>The ultimate full-stack platform for booking sports turfs, hosting tournaments, and organizing open pickup games in Dhaka, Bangladesh.</em></p>

  <!-- Badges -->
  <a href="#"><img src="https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 21" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Spring_Boot-4.1.0-6DB33F?style=for-the-badge&logo=spring&logoColor=white" alt="Spring Boot" /></a>
  <a href="#"><img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" /></a>
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
</div>

---

## 📖 Overview

**TurfChai** is a modern, high-performance web application designed to connect sports enthusiasts with local venues. It provides tailored experiences for three distinct user roles:
- 🏃‍♂️ **Players**: Search for venues, book slots, join open games, and split payments.
- 🏢 **Venue Owners**: Manage pitch schedules, dynamically configure peak/off-peak pricing, and track revenue.
- 🛡️ **Administrators**: Review turf registrations, handle dispute resolution, and manage owner payouts.

## 🛠️ Technology Stack

### Backend
- **Core**: Java 21, Spring Boot 4.1.0, Apache Maven
- **Security**: Spring Security with JWT Authentication
- **Database**: PostgreSQL with Spring Data JPA / Hibernate 7
- **Migrations**: Flyway (Strict versioned schema)
- **AI Module**: Custom RAG & Tool Calling agent (`com.turfchai.ai`) powered by OpenRouter LLMs.

### Frontend
- **Framework**: React 18, Vite 7
- **Routing**: React Router v6
- **Styling**: Vanilla CSS utilizing custom design tokens and utility classes.

---

## 🚀 Quick Start (Local Development)

All teammates work locally. You must have **JDK 21**, **Node.js LTS**, and **PostgreSQL 16** installed.

### 1. Database Setup
Start your local PostgreSQL instance and run the following (as the superuser `postgres`):
```sql
CREATE ROLE turfchai LOGIN PASSWORD 'turfchai_dev';
CREATE DATABASE turfchai OWNER turfchai;
```
*(Note: Flyway will automatically execute migrations and apply the baseline schemas when the app boots up).*

### 2. Backend Boot
Configure your environment using a `.env` file at the repository root if you need to override default credentials, then build and run:
```bash
# Ensure Java 21 is active
./mvnw clean compile
./mvnw spring-boot:run
```
The backend API will be available at `http://localhost:8080/api/v1/health`.

### 3. Frontend Boot
```bash
cd frontend
npm install
npm run dev
```
The application UI will be available at `http://localhost:5173`.

---

## 🤖 For AI Agents

We actively employ AI coding assistants to develop this repository. If you are an AI agent (Cursor, Claude Code, Aider, etc.) reading this, please immediately refer to the **`AGENTS.md`** files located in the customization roots (e.g., `Mugdho/AGENTS.md` or `.agents/`). 

These files are built using the [GenerateAgents.md by originalankur](https://github.com/originalankur/GenerateAgents.md) standard (strict style). They contain mandatory constraints, architectural rules, and anti-patterns extracted from our Git history that you **must** adhere to before writing or modifying any code.

---

## 🧪 Testing

The backend is fully verified with 154+ unit tests utilizing an in-memory H2 database to prevent local Postgres pollution.
```bash
# Run all backend tests
./mvnw test
```

## 📄 License
Copyright © 2026 TurfChai. All rights reserved.
