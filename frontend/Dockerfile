# Stage 1: Build React frontend
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency declarations
COPY package.json package-lock.json ./

# Install dependencies cleanly
RUN npm ci

# Copy application source
COPY . .

# Build static production bundle
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
