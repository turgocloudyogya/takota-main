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

# Expose HTTP port
EXPOSE 80

# Start the backend in the background, then Nginx in the foreground
CMD ["sh", "-c", "/usr/local/bin/takota-api & exec nginx -g 'daemon off;'"]
