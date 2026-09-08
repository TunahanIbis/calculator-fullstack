# syntax=docker/dockerfile:1

# ---- build stage --------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Install against the lockfile for reproducible builds. Cached until either
# manifest changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime stage ----------------------------------------------------
# nginx-unprivileged runs as a non-root user (uid 101) and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# COPY as root so ownership/permissions are predictable, then drop back to the
# unprivileged user the base image ships with.
USER root
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
USER nginx

EXPOSE 8080

# The base image has busybox wget; a 200 from the SPA root means nginx is up.
HEALTHCHECK --interval=15s --timeout=3s --start-period=3s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8080/ || exit 1
