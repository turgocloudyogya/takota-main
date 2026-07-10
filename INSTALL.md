# 📦 Panduan Instalasi Takota

Panduan lengkap untuk menginstall dan menjalankan Takota di berbagai environment.

## Daftar Isi
- [Quick Start (Recommended)](#quick-start-recommended)
- [Manual Installation](#manual-installation)
- [Docker Installation](#docker-installation)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Quick Start (Recommended)

Cara tercepat untuk menjalankan Takota di local:

### 1. Prerequisites

Pastikan sudah terinstall:
- Go 1.25+ → [Download](https://golang.org/dl/)
- Node.js 16+ & npm → [Download](https://nodejs.org/)
- PostgreSQL 13+ → [Download](https://www.postgresql.org/download/)
- Chrome/Chromium (untuk PDF) → [Download](https://www.google.com/chrome/)

**Cek instalasi:**
```bash
make check
```

### 2. Clone & Setup

```bash
# Clone repository (atau extract ZIP)
cd takota

# Setup environment
make setup

# Edit .env dengan konfigurasi Anda
nano .env
```

### 3. Install Dependencies

```bash
make install
```

### 4. Setup Database

```bash
# Buat database PostgreSQL
createdb takota_db

# Atau via psql
psql -U postgres
CREATE DATABASE takota_db;
\q

# Run migrations
psql -U postgres -d takota_db -f migrations/001_initial_schema.sql
psql -U postgres -d takota_db -f migrations/002_add_sign_status.sql
```

### 5. Run Application

```bash
# Jalankan backend + frontend sekaligus
make dev

# Atau jalankan terpisah di terminal berbeda:
# Terminal 1:
make backend

# Terminal 2:
make frontend
```

### 6. Akses Aplikasi

- 🌐 **Frontend**: http://localhost:5173
- 🔧 **Backend API**: http://localhost:8080
- 📖 **Health Check**: http://localhost:8080/health

---

## Manual Installation

### Backend

1. **Install Go dependencies:**
   ```bash
   go mod download
   go mod tidy
   ```

2. **Setup environment:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`:**
   ```env
   SERVER_PORT=8080
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=takota_db
   JWT_SECRET=your_secret_key_here
   # ... (lihat .env.example untuk lengkapnya)
   ```

4. **Run migrations:**
   ```bash
   psql -U postgres -d takota_db -f migrations/001_initial_schema.sql
   psql -U postgres -d takota_db -f migrations/002_add_sign_status.sql
   ```

5. **Run backend:**
   ```bash
   go run cmd/api/main.go
   ```

### Frontend

1. **Install npm dependencies:**
   ```bash
   cd web
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Konfigurasi base URL:**
   - Buka http://localhost:5173
   - Login sebagai admin
   - Menu **Pengaturan** → Set Base URL ke `http://localhost:8080`
   - Matikan **Mock Mode**

---

## Docker Installation

Cara termudah untuk menjalankan semua dependencies (PostgreSQL, Redis, MinIO):

### 1. Install Docker

- Docker Desktop → [Download](https://www.docker.com/products/docker-desktop)
- Docker Compose (biasanya sudah include dengan Docker Desktop)

### 2. Run Services

```bash
# Start all services (PostgreSQL, Redis, MinIO)
make docker-up

# atau
docker-compose up -d

# Cek status
docker-compose ps
```

### 3. Services yang berjalan:

- **PostgreSQL**: `localhost:5432`
  - User: `takota`
  - Password: `takota_password`
  - Database: `takota_db`

- **Redis**: `localhost:6379`

- **MinIO**: 
  - API: `localhost:9000`
  - Console: `localhost:9001`
  - User: `minioadmin`
  - Password: `minioadmin`

### 4. Run Backend & Frontend

```bash
# Di terminal terpisah dari Docker
make backend  # atau go run cmd/api/main.go
make frontend # atau cd web && npm run dev
```

### 5. Stop Services

```bash
make docker-down
# atau
docker-compose down
```

---

## Production Deployment

### Build untuk Production

```bash
# Build semua
make build

# Atau terpisah:
make build-backend   # Output: bin/takota-api
make build-frontend  # Output: web/dist/
```

### Deploy Backend

1. **Copy files ke server:**
   ```bash
   scp bin/takota-api user@server:/opt/takota/
   scp -r templates user@server:/opt/takota/
   scp .env user@server:/opt/takota/
   ```

2. **Setup systemd service:**
   ```bash
   sudo nano /etc/systemd/system/takota.service
   ```

   ```ini
   [Unit]
   Description=Takota API Server
   After=network.target postgresql.service

   [Service]
   Type=simple
   User=takota
   WorkingDirectory=/opt/takota
   ExecStart=/opt/takota/takota-api
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

3. **Start service:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable takota
   sudo systemctl start takota
   sudo systemctl status takota
   ```

### Deploy Frontend

**Option 1: Serve dengan Nginx**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/takota/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Option 2: Serve dari Backend (Static Files)**

Edit `cmd/api/main.go` untuk serve static files:

```go
// Serve frontend static files
router.Static("/assets", "./web/dist/assets")
router.StaticFile("/", "./web/dist/index.html")
router.NoRoute(func(c *gin.Context) {
    c.File("./web/dist/index.html")
})
```

### Docker Compose Production

```bash
# Build dan run dengan Docker
docker-compose up -d --build

# Lihat logs
docker-compose logs -f api
```

---

## Troubleshooting

### 1. Chrome/Chromium tidak ditemukan untuk PDF

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install chromium-browser
```

**Fedora:**
```bash
sudo dnf install chromium
```

**macOS:**
```bash
brew install --cask chromium
```

### 2. Port 8080 sudah digunakan

```bash
# Cek process yang menggunakan port
lsof -i :8080

# Kill process
kill -9 <PID>

# Atau ubah port di .env
SERVER_PORT=8081
```

### 3. Database connection error

```bash
# Cek PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Test koneksi
psql -U postgres -d takota_db -c "SELECT 1;"
```

### 4. Go dependencies error

```bash
# Clear cache dan reinstall
go clean -modcache
go mod download
go mod tidy
```

### 5. Frontend tidak connect ke backend

1. Cek backend running di http://localhost:8080/health
2. Buka browser console (F12) untuk lihat error
3. Pastikan Base URL di settings frontend benar
4. Matikan Mock Mode di settings
5. Check CORS jika deploy di domain berbeda

### 6. MinIO bucket tidak ditemukan

```bash
# Login ke MinIO console: http://localhost:9001
# User: minioadmin, Password: minioadmin
# Buat bucket bernama "takota-bucket" atau sesuai .env
```

### 7. PDF generation error

```bash
# Test chromium
chromium --version

# Test manual generate PDF
chromedp --headless --disable-gpu --print-to-pdf=test.pdf https://example.com
```

### 8. npm install error di frontend

```bash
cd web
rm -rf node_modules package-lock.json
npm install

# Atau gunakan yarn
yarn install
```

---

## Environment Variables

Lihat file `.env.example` untuk list lengkap environment variables yang tersedia.

**Minimal required:**
- `SERVER_PORT`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`

---

## Default Credentials

**Admin User** (setelah run migration):
- Username: `admin`
- Password: `admin123` (ganti setelah first login!)

**MinIO:**
- User: `minioadmin`
- Password: `minioadmin`

**PostgreSQL (Docker):**
- User: `takota`
- Password: `takota_password`
- Database: `takota_db`

---

## Next Steps

Setelah instalasi berhasil:

1. ✅ Login sebagai admin
2. ✅ Ganti password default
3. ✅ Buat user siswa pertama
4. ✅ Test fitur presensi
5. ✅ Test generate PDF rekap

Lihat [README_PROJECT.md](README_PROJECT.md) untuk dokumentasi lengkap fitur.

---

## Support

Jika ada masalah:
1. Cek [Troubleshooting](#troubleshooting) di atas
2. Lihat logs: `docker-compose logs` atau `journalctl -u takota`
3. Buka issue di repository

**Happy Coding! 🚀**
