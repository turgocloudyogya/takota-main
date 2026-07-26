# 🚀 Quick Start - Development Setup

Panduan singkat untuk developer yang ingin menjalankan Takota di local.

**Takota** adalah aplikasi full-stack untuk presensi dan absensi:
- **Backend**: Go (Gin framework) - API server
- **Frontend**: React (Vite) - Web interface
- **Services**: PostgreSQL, Redis, MinIO (via Docker)

---

## ⚡ Cara Tercepat (Recommended)

### Prerequisites

- Docker & Docker Compose
- Go 1.23+
- Node.js 16+
- Make (optional, tapi recommended)

**Cek prerequisites:**
```bash
make check
```

### Setup dalam 4 Langkah

```bash
# 1. Clone repository
git clone <your-repo-url>
cd takota

# 2. Setup environment
make setup
# Creates .env from .env.example

# 3. Install dependencies
make install
# Installs Go modules + npm packages

# 4. Start everything
make docker-up    # Start PostgreSQL, Redis, MinIO
make dev          # Start Backend + Frontend
```

**Akses aplikasi:**
```
✅ Frontend:        http://localhost:5173 (Vite dev server)
✅ Backend API:     http://localhost:8080
✅ API Health:      http://localhost:8080/health
✅ MinIO Console:   http://localhost:9001

📦 PostgreSQL:      localhost:5432
📦 Redis:           localhost:6379
```

**Default Login:**
- **Admin**: username `admin`, password `admin123`
- **User**: username `user001`, password `user123`

**Kenapa cara ini recommended?**
- ✅ Fastest iteration (hot reload)
- ✅ Easy debugging dengan IDE
- ✅ Frontend hot reload (Vite)
- ✅ Backend auto-restart on changes
- ✅ One command to rule them all

---

## 🛠️ Cara Menjalankan

### Opsi 1: Make Commands ⭐ RECOMMENDED

**Kelebihan:**
- ✅ Satu command untuk semua
- ✅ Hot reload (frontend & backend)
- ✅ Easy debugging
- ✅ Fastest development iteration
- ✅ Auto-install dependencies

**Full Workflow:**

```bash
# Setup awal (sekali saja)
make check          # ✓ Check prerequisites (Go, Node, Docker)
make setup          # ✓ Create .env from .env.example
make install        # ✓ Install Go + npm dependencies
make docker-up      # ✓ Start PostgreSQL, Redis, MinIO

# Development (setiap hari)
make dev            # ✓ Run backend + frontend dengan hot reload

# Access:
# Frontend: http://localhost:5173 (Vite dev server)
# Backend:  http://localhost:8080 (Go API)
```

**Development Flow:**
1. Edit frontend code (`web/src/`) → Vite hot reload otomatis
2. Edit backend code (`cmd/`, `internal/`, `pkg/`) → Go auto-restart
3. Save & test immediately

**Available Make Commands:**

```bash
# Setup & Install
make check          # Check system requirements (Go, Node, Docker)
make setup          # Create .env file
make install        # Install all dependencies (Go + npm)

# Development
make dev            # Run backend + frontend (hot reload)
make backend        # Run backend only
make frontend       # Run frontend only

# Docker Services
make docker-up      # Start PostgreSQL, Redis, MinIO
make docker-down    # Stop all Docker services
make docker-logs    # View Docker logs

# Build
make build          # Build both (binary + static files)
make build-backend  # Build Go binary → bin/takota-api
make build-frontend # Build React static → web/dist/

# Testing
make test           # Run all tests
make test-backend   # Backend tests only
make test-frontend  # Frontend tests only

# Cleanup
make clean          # Remove build artifacts
```

**Typical Development Day:**

```bash
# Morning: Start services
make docker-up
make dev

# Develop...
# (edit code, auto-reload, test)

# Evening: Stop services
# Ctrl+C to stop make dev
make docker-down
```

---

## 🛑 Cara Stop Semua Services

### Stop Development (make dev)

```bash
# Di terminal yang menjalankan make dev:
Ctrl+C

# Ini akan stop:
# - Backend (go run)
# - Frontend (npm run dev)
```

### Stop Docker Services

```bash
# Stop semua container
make docker-down

# Atau manual:
docker compose down

# Stop dan hapus volumes (⚠️ DATA AKAN HILANG)
docker compose down -v
```

### Stop Semua (Complete Shutdown)

```bash
# 1. Stop make dev (Ctrl+C)
# 2. Stop Docker
make docker-down

# Verify semua sudah stop
docker ps
# Should show empty or no takota containers
```

---

## ⚠️ Troubleshooting: Network Still in Use

**Problem:**
```bash
docker compose down
# Error: Network takota_takota-network Resource is still in use
```

**Cause:**
Container masih running yang menggunakan network tersebut.

**Solution:**

```bash
# 1. Cek container yang masih running
docker ps -a | grep takota

# 2. Stop semua container takota
docker stop takota-api takota-postgres takota-redis takota-minio

# 3. Remove containers
docker rm takota-api takota-postgres takota-redis takota-minio

# 4. Sekarang bisa docker compose down
docker compose down

# Atau force remove network:
docker network rm takota_takota-network
```

**Prevention:**
- Selalu gunakan `docker compose` untuk manage containers
- Jangan manual `docker run` untuk service yang ada di docker-compose.yml
- Gunakan `make docker-up` dan `make docker-down`

---

### Opsi 2: Docker Compose (All-in-One)

**Kelebihan:**
- ✅ Production-like environment
- ✅ Tidak perlu Go/Node di host
- ⚠️ No hot reload (need rebuild)

**Cara:**
```bash
# Start everything (backend, frontend, services)
docker compose up -d --build

# Wait ~30 seconds
docker compose ps

# Access
http://localhost:8080

# Logs
docker compose logs -f api

# Stop
docker compose down
```

**When to use:**
- Testing production build
- Demo ke client
- Tidak mau install Go/Node

---

### Opsi 3: Manual (Tanpa Make)

**Setup:**

```bash
# 1. Setup .env
cp .env.example .env

# 2. Install dependencies
go mod download
cd web && npm install && cd ..

# 3. Start Docker services
docker compose up -d postgres redis minio

# 4. Start backend (Terminal 1)
go run cmd/api/main.go

# 5. Start frontend (Terminal 2)
cd web
npm run dev
```

**When to use:**
- Make tidak tersedia
- Custom workflow
- Advanced debugging

---

## 📊 Comparison: Which Option?

| Feature | Make Commands | Docker Compose | Manual |
|---------|--------------|----------------|--------|
| **Setup Time** | Fast | Fastest | Slow |
| **Hot Reload** | ✅ Yes | ❌ No | ✅ Yes |
| **Debugging** | ✅ Easy | ⚠️ Complex | ✅ Easy |
| **Prerequisites** | Go + Node + Docker | Docker only | Go + Node + Docker |
| **Production-like** | ❌ No | ✅ Yes | ❌ No |
| **Best For** | **Daily dev** | Demo/Testing | Custom needs |

**Our Recommendation:**
- **Development**: Use `make dev` (hot reload, fast iteration)
- **Testing/Demo**: Use `docker compose up` (production-like)
- **CI/CD**: Use `make build` + Docker

---

## 🛠️ Command Reference

### Docker Management

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Stop dan hapus semua data (⚠️ DESTRUCTIVE)
docker compose down -v

# View logs
docker compose logs -f api          # API logs
docker compose logs -f postgres     # Database logs

# Restart single service
docker compose restart api

# Rebuild single service
docker compose up -d --build api

# Check status
docker compose ps

# Stop semua container takota
docker stop $(docker ps -q --filter "name=takota")

# Remove semua container takota
docker rm $(docker ps -aq --filter "name=takota")
```

### Development Workflow

```bash
# 1. Make changes to backend code (internal/, pkg/, cmd/)
# 2. Rebuild & restart
docker compose up -d --build api

# 3. Make changes to frontend code (web/src/)
# 4. Rebuild frontend
cd web
npm run build
cd ..

# 5. Restart API to serve new frontend
docker compose restart api
```

---

## 📦 What's Inside Docker?

| Container | Service | Port | Purpose |
|-----------|---------|------|---------|
| `takota-api` | Go Backend + Frontend | 8080 | Main application |
| `takota-postgres` | PostgreSQL 16 | 5432 | Database |
| `takota-redis` | Redis 7 | 6379 | Cache (optional) |
| `takota-minio` | MinIO/S3 | 9000, 9001 | File storage |

---

## 🔧 Konfigurasi Environment

File `.env` sudah pre-configured untuk development, tapi bisa disesuaikan:

```bash
# Server
PORT=8080                        # API port

# Database
DB_HOST=takota-postgres          # Container name
DB_PORT=5432
DB_USER=takota
DB_PASSWORD=takota_password
DB_NAME=takota_db

# Redis (Optional - bisa di-disable)
REDIS_URL=redis://takota-redis:6379

# MinIO/S3
S3_ENDPOINT=takota-minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=takota-bucket

# JWT
JWT_SECRET=change-this-secret-in-production-please
JWT_EXPIRY_HOURS=24

# GPS Validation (disabled by default)
ATTENDANCE_RADIUS_ENABLED=false
ATTENDANCE_RADIUS_METERS=5000
```

---

## 📝 Testing Features

### 1. Login sebagai Admin
```bash
curl -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. Get User Info
```bash
# Replace TOKEN with the token from login response
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8080/api/all/info
```

### 3. List Users (Admin only)
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8080/api/admin/users
```

### 4. Test PDF Export
- Login sebagai admin di browser
- Go to "Rekap & Unduh"
- Pilih periode & siswa
- Click "Buat & Unduh PDF"

---

## 🐛 Troubleshooting

### Container tidak start

```bash
# Cek status
docker compose ps

# Cek logs
docker compose logs api

# Restart semua
docker compose down
docker compose up -d
```

### Port already in use

```bash
# Ubah port di .env
PORT=8081

# Atau kill process yang menggunakan port
lsof -i :8080        # macOS/Linux
netstat -ano | findstr :8080  # Windows
```

### Database connection error

```bash
# Ensure PostgreSQL container is healthy
docker compose ps | grep postgres

# Check logs
docker compose logs postgres

# Restart
docker compose restart postgres
```

### Redis connection error

```bash
# Redis is optional, API will fallback to PostgreSQL
# To fix Redis:
docker compose restart redis

# Or disable Redis in .env:
REDIS_URL=
```

### PDF generation tidak berfungsi

```bash
# Check logs:
docker compose logs api | grep -i "pdf"

# Rebuild container:
docker compose up -d --build api
```

---

## 📚 Dokumentasi Lengkap

Untuk informasi lebih detail:

- **[INSTALL.md](INSTALL.md)** - Instalasi lengkap & troubleshooting
- **[README.md](README.md)** - Overview project & fitur lengkap
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Struktur folder
- **[DOCS_INDEX.md](DOCS_INDEX.md)** - Index semua dokumentasi

---

## 🎯 Next Steps

Setelah development:

1. **Testing**: Test semua fitur (attendance, absence, PDF export)
2. **Production**: Lihat [DEPLOYMENT_STRATEGIES.md](DEPLOYMENT_STRATEGIES.md)
3. **Updates**: Commit changes dan push ke repo

---

## ✅ Development Checklist

- [ ] Docker & Docker Compose installed
- [ ] Clone repository
- [ ] Copy `.env.example` to `.env`
- [ ] `docker compose up -d --build`
- [ ] Wait for services healthy (~30s)
- [ ] Open http://localhost:8080
- [ ] Login dengan admin/admin123
- [ ] Test features
- [ ] Ready to develop! 🚀

---

**Happy Coding! 🎉**

Need help? Check logs dengan `docker compose logs -f api`
