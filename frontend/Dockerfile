# syntax=docker/dockerfile:1

# ---- build stage ----------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies against the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime stage ------------------------------------------------------
# The -unprivileged image runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# Basic liveness check (nginx + curl are present in this image).
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8080/ >/dev/null 2>&1 || exit 1
