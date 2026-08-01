# =========================================================
# Takota - Multi-stage Dockerfile
# Builds the React frontend and Go backend, then packages
# both into a single Nginx image that serves the frontend
# and reverse-proxies /api/* to the backend.
# =========================================================

# ---------- Stage 1: Build frontend ----------
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

# Install dependencies first (better layer caching)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and build
COPY frontend/ .
RUN npm run build

# ---------- Stage 2: Build backend ----------
FROM golang:1.25-alpine AS backend-build

WORKDIR /app/backend

# Install build dependencies
RUN apk add --no-cache git

# Download modules first (better layer caching)
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy source and build a static binary
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /out/takota-api ./cmd/api

# ---------- Stage 3: Final image (Nginx + backend) ----------
FROM nginx:1.27-alpine

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Nginx config (serves frontend + proxies /api to backend)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Frontend static files
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Backend binary
COPY --from=backend-build /out/takota-api /usr/local/bin/takota-api

# Supervisor: runs backend + nginx, exits the container if either dies
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Health check goes through nginx -> backend /health, so it only reports
# healthy when both nginx and the API are responding.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O- http://127.0.0.1/health >/dev/null 2>&1 || exit 1

# Expose HTTP port
EXPOSE 80

CMD ["/usr/local/bin/entrypoint.sh"]
