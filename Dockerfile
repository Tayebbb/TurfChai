# Stage 1: Build application using Maven and Java 21
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /app

# Copy Maven POM and source files
COPY pom.xml .
COPY src ./src

# Package application (skip tests during Docker build)
RUN mvn clean package -DskipTests

# Stage 2: Runtime environment using Java 21 JRE
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Render dynamically sets PORT at runtime; default to 8080
ENV PORT=8080
EXPOSE 8080

# Copy built Spring Boot executable JAR from builder stage
COPY --from=builder /app/target/turfchai-0.0.1-SNAPSHOT.jar app.jar

# Run the Spring Boot application
ENTRYPOINT ["java", "-jar", "app.jar"]
