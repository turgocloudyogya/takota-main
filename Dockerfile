# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web

# Copy frontend package files first for better layer caching
COPY web/package*.json ./

# Install dependencies (including devDependencies for build)
# Use --legacy-peer-deps in case of peer dependency conflicts
RUN npm ci || npm install --legacy-peer-deps

# Copy frontend source
COPY web/ ./

# Build frontend for production
# Set NODE_OPTIONS to increase memory if needed
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Verify build output exists
RUN ls -la dist/ && echo "Frontend build successful"

# ============================================
# Stage 2: Build Backend
# ============================================
FROM golang:1.23-alpine AS backend-builder

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

# Set GOTOOLCHAIN to auto untuk allow Go version lebih tinggi
ENV GOTOOLCHAIN=auto

# Build arguments
ARG VERSION=dev
ARG BUILD_DATE=unknown

WORKDIR /app

# Copy go mod files first for better layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY pkg/ ./pkg/

# Build the application with optimizations
# Note: Removed GOARCH=amd64 to build for target platform (multi-arch support)
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s -X main.version=${VERSION} -X main.buildTime=${BUILD_DATE}" \
    -a -installsuffix cgo \
    -o takota-api ./cmd/api

# Verify binary is built and executable
RUN ls -lh takota-api && test -x takota-api && echo "✓ Binary built successfully"

# ============================================
# Stage 3: Final Production Image
# ============================================
FROM alpine:latest

# Build arguments
ARG VERSION=dev
ARG BUILD_DATE=unknown

# Add metadata labels
LABEL maintainer="Takota Team"
LABEL org.opencontainers.image.title="Takota Attendance System"
LABEL org.opencontainers.image.description="Production-ready attendance management system"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"

# Install runtime dependencies
RUN apk --no-cache add \
    ca-certificates \
    tzdata \
    wget \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1000 takota && \
    adduser -D -u 1000 -G takota takota

# Set working directory
WORKDIR /app

# Copy binary from backend builder
COPY --from=backend-builder --chown=takota:takota /app/takota-api .

# Copy frontend dist from frontend builder
COPY --from=frontend-builder --chown=takota:takota /app/web/dist ./web/dist

# Copy templates directory (required for PDF export)
COPY --chown=takota:takota templates/ ./templates/

# Copy .env.example for reference (optional)
COPY --chown=takota:takota .env.example .

# Make binary executable
RUN chmod +x ./takota-api

# Switch to non-root user
USER takota

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./takota-api"]
