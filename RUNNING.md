# 🚀 Cara Menjalankan Aplikasi Takota

Panduan lengkap untuk menjalankan aplikasi Takota (Backend + Frontend) di local development maupun production.

---

## 📋 Daftar Isi

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Metode 1: Development dengan Make (Recommended)](#metode-1-development-dengan-make-recommended)
- [Metode 2: Manual (Tanpa Make)](#metode-2-manual-tanpa-make)
- [Metode 3: Docker Compose (All-in-One)](#metode-3-docker-compose-all-in-one)
- [Metode 4: Production Build](#metode-4-production-build)
- [Login Default](#login-default)
- [Port & URL](#port--url)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

**Takota** adalah aplikasi full-stack dengan arsitektur:

```
┌─────────────────────────────────────────┐
│  Frontend (React + Vite)                │
│  Port: 5173 (dev) / 8080 (production)   │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Backend (Go + Gin)                     │
│  Port: 8080                             │
└─────────────────────────────────────────┘
                   ↓
┌──────────────┬──────────────┬───────────┐
│ PostgreSQL   │    Redis     │   MinIO   │
│   :5432      │    :6379     │  :9000    │
└──────────────┴──────────────┴───────────┘
```

**Komponen:**
- **Backend**: Go 1.23+, Gin framework, REST API
- **Frontend**: React 18+, Vite 8+, Tailwind CSS
- **Database**: PostgreSQL 16
- **Cache**: Redis 7 (optional)
- **Storage**: MinIO (S3-compatible)

---

## ✅ Prerequisites

Pastikan sudah terinstall:

### Wajib
- [x] **Docker & Docker Compose** - untuk database & services
- [x] **Go 1.23+** - untuk backend
- [x] **Node.js 16+** dan npm - untuk frontend
- [x] **Make** (optional tapi recommended)

### Optional
- [x] **Chromium/Chrome** - untuk generate PDF (bisa pakai Docker juga)
- [x] **Git** - untuk clone repository

### Cek Prerequisites

```bash
# Cek semua requirements
make check

# Output:
# ✅ Go installed: go version go1.23 ...
# ✅ Node.js installed: v20.x.x
# ✅ npm installed: 10.x.x
# ✅ Docker installed: Docker version ...
```

**Instalasi Prerequisites:**

**macOS (Homebrew):**
```bash
brew install go node docker make
brew install --cask docker    # Docker Desktop
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install golang-1.23 nodejs npm docker.io docker-compose make
```

**Windows (Chocolatey):**
```powershell
choco install golang nodejs docker-desktop make
```

---

## 🟢 Metode 1: Development dengan Make (Recommended)

**Cara tercepat untuk development dengan hot reload!**

### Step 1: Setup Environment

```bash
# Clone repository (jika belum)
git clone <repository-url>
cd takota-app

# Setup environment variables
make setup

# Edit .env jika perlu
nano .env
```

### Step 2: Install Dependencies

```bash
# Install Go modules + npm packages
make install

# Output:
# 📦 Installing Go dependencies...
# 📦 Installing npm dependencies...
# ✅ All dependencies installed!
```

### Step 3: Start Services (PostgreSQL, Redis, MinIO)

```bash
# Start Docker services (services only, NO API container)
make docker-up

# Output:
# 🐳 Starting Docker services (services only, no API)...
# ✅ Services started!
# 📊 PostgreSQL: localhost:5432
# 🔴 Redis:      localhost:6379
# 📦 MinIO:      localhost:9000 (Console: 9001)
# ℹ️  API tidak dijalankan via Docker (gunakan: make dev)

# Cek status services
docker ps
# Expected: postgres, redis, minio (NO takota-api container!)
```

**⚠️ PENTING:** Pastikan container `takota-api` TIDAK running! Jika ada, stop dulu:
```bash
docker stop takota-api
```

### Step 4: Run Backend + Frontend

```bash
# Start backend + frontend dengan hot reload
make dev

# Output:
# 🔥 Starting Backend (Go)...
# 🔥 Starting Frontend (React + Vite)...
# ✅ Backend running on http://localhost:8080
# ✅ Frontend running on http://localhost:5173
```

**Atau jalankan terpisah:**

```bash
# Terminal 1: Backend only
make backend

# Terminal 2: Frontend only
make frontend
```

### Step 5: Akses Aplikasi

- **Frontend (Development)**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/health
- **MinIO Console**: http://localhost:9001 (minioadmin / minioadmin)

### Stop Services

```bash
# Stop backend + frontend: Ctrl+C di terminal

# Stop Docker services
make docker-down
```

---

## 🔵 Metode 2: Manual (Tanpa Make)

Jika tidak punya Make atau ingin kontrol penuh:

### Step 1: Setup Environment

```bash
cd takota-app

# Copy .env.example ke .env
cp .env.example .env

# Edit konfigurasi
nano .env
```

### Step 2: Start Docker Services

```bash
# Start PostgreSQL, Redis, MinIO
docker-compose up -d

# Cek status
docker-compose ps
```

### Step 3: Install Dependencies

**Backend (Go):**
```bash
cd /path/to/takota-app
go mod download
go mod tidy
```

**Frontend (React):**
```bash
cd web
npm install
```

### Step 4: Run Backend

```bash
# Terminal 1: Backend
cd /path/to/takota-app

# Load environment variables
export $(cat .env | xargs)

# Run Go backend
go run cmd/api/main.go

# Output:
# [GIN-debug] Listening and serving HTTP on :8080
```

### Step 5: Run Frontend

```bash
# Terminal 2: Frontend
cd web

# Run Vite dev server
npm run dev

# Output:
# VITE v8.x.x ready in XXX ms
# ➜ Local: http://localhost:5173/
```

### Step 6: Akses Aplikasi

- Frontend: http://localhost:5173
- Backend: http://localhost:8080

---

## 🐳 Metode 3: Docker Compose (All-in-One)

**Semua services jalan di Docker (tidak perlu install Go/Node di host).**

### Step 1: Setup Environment

```bash
cd takota-app
cp .env.example .env
```

### Step 2: Build & Run

```bash
# Build images dan start semua services
docker-compose up -d --build

# Output:
# Creating takota-postgres ... done
# Creating takota-redis ... done
# Creating takota-minio ... done
# Creating takota-api ... done
```

### Step 3: Cek Status

```bash
# Cek container status
docker-compose ps

# Lihat logs
docker-compose logs -f api
```

### Step 4: Akses Aplikasi

- **Aplikasi**: http://localhost:8080
- **API**: http://localhost:8080/api/*
- **MinIO Console**: http://localhost:9001

### Stop Services

```bash
# Stop dan hapus containers
docker-compose down

# Stop + hapus volumes (HATI-HATI: data akan hilang)
docker-compose down -v
```

---

## 🚀 Metode 4: Production Build

**Untuk deployment production:**

### Step 1: Build Backend

```bash
# Build Go binary
make build-backend

# Output:
# 🔨 Building backend...
# ✅ Backend built: bin/takota-api

# Binary tersimpan di: bin/takota-api
```

**Manual:**
```bash
mkdir -p bin
go build -o bin/takota-api cmd/api/main.go
```

### Step 2: Build Frontend

```bash
# Build static files
make build-frontend

# Output:
# 🔨 Building frontend...
# ✅ Frontend built: web/dist/

# Static files tersimpan di: web/dist/
```

**Manual:**
```bash
cd web
npm run build
```

### Step 3: Build All

```bash
# Build backend + frontend sekaligus
make build

# Output:
# ✅ Build complete!
# 📦 Backend binary: bin/takota-api
# 📦 Frontend static: web/dist/
```

### Step 4: Run Production

```bash
# Setup environment
export $(cat .env | xargs)
export APP_ENV=production
export GIN_MODE=release

# Run binary
./bin/takota-api

# Output:
# [GIN] Running in "release" mode
# [GIN] Listening and serving HTTP on :8080
```

**Frontend sudah ter-embed di backend**, akses via:
- http://localhost:8080

---

## 🔐 Login Default

Setelah aplikasi jalan, gunakan akun default:

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | `admin`  | `admin123` |
| User  | `user001` | `user123` |

**⚠️ PENTING:** Ganti password default setelah login pertama kali!

---

## 🌐 Port & URL

### Development (Metode 1 & 2)

| Service    | Port  | URL                           | Keterangan                |
|------------|-------|-------------------------------|---------------------------|
| Frontend   | 5173  | http://localhost:5173         | Vite dev server (hot reload) |
| Backend    | 8080  | http://localhost:8080         | API server                |
| PostgreSQL | 5432  | localhost:5432                | Database                  |
| Redis      | 6379  | localhost:6379                | Cache (optional)          |
| MinIO      | 9000  | http://localhost:9000         | S3 API                    |
| MinIO UI   | 9001  | http://localhost:9001         | Web console               |

### Production (Metode 3 & 4)

| Service    | Port  | URL                           | Keterangan                |
|------------|-------|-------------------------------|---------------------------|
| App        | 8080  | http://localhost:8080         | Frontend + Backend        |
| PostgreSQL | 5432  | localhost:5432                | Database                  |
| Redis      | 6379  | localhost:6379                | Cache                     |
| MinIO      | 9000  | http://localhost:9000         | S3 API                    |

---

## 🧪 Testing

### Health Check

```bash
# Test backend
curl http://localhost:8080/health

# Expected output:
# {"status":"OK"}
```

### Test Login

```bash
# Login sebagai admin
curl -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Expected output:
# {"token":"eyJhbGc...", "role":"admin"}
```

### Test API dengan Token

```bash
# Get user info (ganti YOUR_TOKEN dengan token dari login)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/all/info

# Expected output:
# {"id":"...", "username":"admin", "role":"admin", ...}
```

---

## 🛠️ Troubleshooting

### ❌ Problem: Delete Photo Error 404 "page not found"

**Error:**
```
DELETE http://localhost:8080/api/admin/photo
404 Not Found - page not found
```

**Root Cause:**
Docker container `takota-api` masih running dengan **code lama** (pre-built image), sementara Anda menjalankan `make dev` dengan code baru. Request dari browser masuk ke Docker container, bukan ke `go run`.

**Solusi:**
```bash
# 1. Stop Docker API container
docker stop takota-api

# 2. Pastikan tidak ada container takota-api
docker ps | grep takota-api
# Harusnya tidak ada output

# 3. Restart make dev
# (Ctrl+C di terminal make dev, lalu jalankan lagi)
make dev

# 4. Verify port 8080 digunakan oleh go run (bukan Docker)
lsof -i :8080
# Harusnya ada "go run" atau "main"

# 5. Hard refresh browser
# Ctrl+Shift+R (Windows) atau Cmd+Shift+R (Mac)
```

**Prevention:**
Untuk development, gunakan `docker-compose.dev.yml` yang hanya menjalankan services:
```bash
# Stop all
docker-compose down

# Start services only (recommended for dev)
make docker-up

# Run backend + frontend
make dev
```

### ❌ Problem: Port sudah digunakan

**Error:**
```
Error: listen tcp :8080: bind: address already in use
```

**Solusi:**
```bash
# Cek proses yang pakai port 8080
lsof -i :8080          # macOS/Linux
netstat -ano | findstr :8080  # Windows

# Kill process
kill -9 <PID>          # macOS/Linux
taskkill /PID <PID> /F # Windows

# Atau ganti port di .env
PORT=8081
```

### ❌ Problem: Database connection failed

**Error:**
```
failed to connect to database: connection refused
```

**Solusi:**
```bash
# Pastikan PostgreSQL running
docker-compose ps | grep postgres

# Restart PostgreSQL
docker-compose restart postgres

# Cek logs
docker-compose logs postgres

# Test koneksi
docker exec -it takota-postgres psql -U takota -d takota_db
```

### ❌ Problem: Go dependencies error

**Error:**
```
go: missing go.sum entry for module
```

**Solusi:**
```bash
# Clean dan reinstall
go clean -modcache
go mod download
go mod tidy
```

### ❌ Problem: npm install gagal

**Error:**
```
npm ERR! code ELIFECYCLE
```

**Solusi:**
```bash
cd web

# Hapus node_modules dan package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Jika masih error, coba dengan flag legacy
npm install --legacy-peer-deps
```

### ❌ Problem: MinIO bucket tidak ada

**Error:**
```
The specified bucket does not exist
```

**Solusi:**
```bash
# Akses MinIO Console: http://localhost:9001
# Login: minioadmin / minioadmin
# Buat bucket: takota-bucket
# Set policy: public (untuk testing)

# Atau via mc client:
docker exec -it takota-minio mc mb local/takota-bucket
docker exec -it takota-minio mc anonymous set download local/takota-bucket
```

### ❌ Problem: Redis connection error

**Solusi:**
```bash
# Redis is optional, backend akan fallback ke PostgreSQL
# Untuk disable Redis, kosongkan REDIS_URL di .env:
REDIS_URL=

# Atau restart Redis:
docker-compose restart redis
```

### ❌ Problem: Frontend tidak load

**Solusi:**
```bash
# Clear Vite cache
cd web
rm -rf node_modules/.vite

# Rebuild
npm run build

# Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
```

### ❌ Problem: JWT token expired

**Error:**
```
JWT expired, please try login
```

**Solusi:**
```bash
# Login ulang untuk dapat token baru
# Token expire setelah 24 jam (default)

# Atau ganti JWT_EXPIRY_HOURS di .env
JWT_EXPIRY_HOURS=168  # 7 hari
```

### 🔍 Cek Logs

```bash
# Backend logs (development)
# Lihat terminal tempat backend running

# Backend logs (Docker)
docker-compose logs -f api

# PostgreSQL logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis

# MinIO logs
docker-compose logs -f minio

# All logs
docker-compose logs -f
```

---

## 📚 Dokumentasi Lainnya

- **[README.md](README.md)** - Overview project
- **[INSTALL.md](INSTALL.md)** - Panduan instalasi detail
- **[QUICK_START_DEV.md](QUICK_START_DEV.md)** - Quick start development
- **[QUICK_START_PROD.md](QUICK_START_PROD.md)** - Quick start production
- **[DEPLOYMENT_STRATEGIES.md](DEPLOYMENT_STRATEGIES.md)** - Strategi deployment
- **[DOCS_INDEX.md](DOCS_INDEX.md)** - Index semua dokumentasi

---

## 💡 Tips & Best Practices

### Development

1. **Gunakan Make** untuk commands yang konsisten
2. **Hot Reload** otomatis detect perubahan code
3. **Separate Terminal** untuk backend & frontend logs
4. **Check Health** sebelum testing: `curl localhost:8080/health`

### Production

1. **Ganti JWT_SECRET** dengan strong random key
2. **Set GIN_MODE=release** untuk performance
3. **Enable SSL/TLS** untuk database & Redis
4. **Setup Backups** untuk PostgreSQL
5. **Monitor Logs** via syslog atau ELK stack
6. **Use Reverse Proxy** (Nginx/Caddy) untuk SSL termination

### Performance

1. **Connection Pooling**: Set DB_MAX_CONNECTIONS sesuai load
2. **Redis Caching**: Enable untuk response cepat
3. **CDN**: Gunakan CDN untuk static assets
4. **Compression**: Enable gzip di Nginx

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Setup | `make setup` |
| Install | `make install` |
| Start Services | `make docker-up` |
| Run Dev | `make dev` |
| Build | `make build` |
| Stop Services | `make docker-down` |
| Check System | `make check` |
| Clean | `make clean` |
| Test | `make test` |
| Logs | `docker-compose logs -f` |

---

**Butuh bantuan?** Lihat [TROUBLESHOOTING](#troubleshooting) atau buka issue di repository.

**Happy Coding! 🚀**
