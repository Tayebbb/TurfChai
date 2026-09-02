# =============================================================================
# TurfChai — single-service production image
#
# Stage 1 builds the React bundle, stage 2 builds the Spring Boot jar (with the
# bundle baked into /static), stage 3 is the slim runtime. Everything the app
# needs comes from source — no pre-built target/ required.
# =============================================================================

# ---- Stage 1: frontend -------------------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Same-origin: the API client falls back to relative /api/v1 when this is
# unset, which is exactly what the single-service deployment wants.
RUN npm run build

# ---- Stage 2: backend jar ----------------------------------------------------
FROM eclipse-temurin:21-jdk AS backend-build

WORKDIR /build
# Maven layer first so dependency changes don't invalidate it on every build.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -B -ntp dependency:go-offline

COPY src/ src/
# VITE_BASE is unset: the SPA is served from the root of the backend origin.
COPY --from=frontend-build /build/frontend/dist/ src/main/resources/static/

RUN ./mvnw -B -ntp package -DskipTests

# ---- Stage 3: runtime ----------------------------------------------------
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=backend-build /build/target/turfchai-0.0.1-SNAPSHOT.jar app.jar

# Render/Koyeb/etc. inject PORT; container platforms keep the default 8080.
EXPOSE 8080

# -XX:MaxRAMPercentage keeps the heap inside small free-tier containers
# (Render free = 512MB) instead of assuming the host's RAM.
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-jar","app.jar"]
