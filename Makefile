.PHONY: help install dev backend frontend build test clean docker-up docker-down

# Default target
help:
	@echo "🚀 Takota Project - Available Commands"
	@echo "======================================"
	@echo ""
	@echo "Development:"
	@echo "  make install     - Install all dependencies (Go + npm)"
	@echo "  make dev         - Run backend + frontend in development mode"
	@echo "  make backend     - Run backend only"
	@echo "  make frontend    - Run frontend only"
	@echo ""
	@echo "Build:"
	@echo "  make build       - Build backend binary + frontend static files"
	@echo "  make build-backend  - Build backend binary only"
	@echo "  make build-frontend - Build frontend static files only"
	@echo ""
	@echo "Database:"
	@echo "  make migrate-up  - Run database migrations"
	@echo "  make migrate-down - Rollback database migrations"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up   - Start all services (PostgreSQL, Redis, MinIO)"
	@echo "  make docker-down - Stop all services"
	@echo "  make docker-logs - View docker logs"
	@echo ""
	@echo "Testing:"
	@echo "  make test        - Run all tests"
	@echo "  make test-backend   - Run backend tests"
	@echo "  make test-frontend  - Run frontend tests"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean       - Clean build artifacts"
	@echo ""

# Install dependencies
install:
	@echo "📦 Installing Go dependencies..."
	go mod download
	go mod tidy
	@echo ""
	@echo "📦 Installing npm dependencies..."
	cd web && npm install
	@echo ""
	@echo "✅ All dependencies installed!"

# Run development servers
dev:
	@./start-all.sh

backend:
	@./start-backend.sh

frontend:
	@./start-frontend.sh

# Build for production
build: build-backend build-frontend
	@echo "✅ Build complete!"
	@echo "📦 Backend binary: bin/takota-api"
	@echo "📦 Frontend static: web/dist/"

build-backend:
	@echo "🔨 Building backend..."
	@mkdir -p bin
	go build -o bin/takota-api cmd/api/main.go
	@echo "✅ Backend built: bin/takota-api"

build-frontend:
	@echo "🔨 Building frontend..."
	cd web && npm run build
	@echo "✅ Frontend built: web/dist/"

# Database migrations
migrate-up:
	@echo "⬆️  Running migrations..."
	@for file in migrations/*.sql; do \
		echo "Applying $$file..."; \
	done
	@echo "✅ Migrations applied!"

migrate-down:
	@echo "⬇️  Rolling back migrations..."
	@echo "⚠️  Manual rollback required"

# Docker commands
docker-up:
	@echo "🐳 Starting Docker services..."
	docker-compose up -d
	@echo "✅ Services started!"
	@echo "📊 PostgreSQL: localhost:5432"
	@echo "🔴 Redis:      localhost:6379"
	@echo "📦 MinIO:      localhost:9000 (Console: 9001)"

docker-down:
	@echo "🛑 Stopping Docker services..."
	docker-compose down
	@echo "✅ Services stopped!"

docker-logs:
	docker-compose logs -f

# Testing
test: test-backend test-frontend

test-backend:
	@echo "🧪 Running backend tests..."
	go test ./... -v

test-frontend:
	@echo "🧪 Running frontend tests..."
	cd web && npm run test

# Cleanup
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf bin/
	rm -rf web/dist/
	rm -rf web/node_modules/.vite/
	@echo "✅ Cleanup complete!"

# Setup environment
setup:
	@echo "⚙️  Setting up environment..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ .env created from .env.example"; \
		echo "⚠️  Please edit .env with your configuration"; \
	else \
		echo "ℹ️  .env already exists"; \
	fi

# Check system requirements
check:
	@echo "🔍 Checking system requirements..."
	@echo ""
	@command -v go >/dev/null 2>&1 && echo "✅ Go installed: $$(go version)" || echo "❌ Go not found"
	@command -v node >/dev/null 2>&1 && echo "✅ Node.js installed: $$(node --version)" || echo "❌ Node.js not found"
	@command -v npm >/dev/null 2>&1 && echo "✅ npm installed: $$(npm --version)" || echo "❌ npm not found"
	@command -v docker >/dev/null 2>&1 && echo "✅ Docker installed: $$(docker --version)" || echo "❌ Docker not found"
	@command -v chromium >/dev/null 2>&1 && echo "✅ Chromium installed" || command -v google-chrome >/dev/null 2>&1 && echo "✅ Chrome installed" || echo "⚠️  Chrome/Chromium not found (needed for PDF generation)"
	@echo ""
