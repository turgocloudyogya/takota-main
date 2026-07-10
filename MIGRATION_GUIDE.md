# 🔄 Migration Guide: Dari Struktur Terpisah ke Unified

Panduan untuk migrasi dari `takota-bacend` + `takota-frontend` yang terpisah ke struktur unified `takota/`.

---

## 📋 Overview

### Struktur Lama
```
takota-full-any/
├── takota-bacend/          # Backend folder
│   ├── cmd/
│   ├── internal/
│   ├── pkg/
│   └── ...
│
└── takota-frontend/
    └── takota-frontend/    # Frontend folder (nested)
        ├── src/
        ├── public/
        └── ...
```

### Struktur Baru
```
takota/                     # Unified project
├── cmd/                    # Backend (di root)
├── internal/
├── pkg/
├── migrations/
├── templates/
├── web/                    # Frontend (di subfolder)
│   ├── src/
│   ├── public/
│   └── ...
├── Makefile               # 🆕
├── start-*.sh             # 🆕
└── *.md (docs)            # 🆕
```

---

## 🎯 Opsi Migrasi

Ada 2 cara untuk migrasi:

### Opsi 1: Gunakan Folder `takota/` yang Sudah Dibuat ✅ (Recommended)

Folder `takota/` sudah otomatis dibuat dengan struktur yang benar.

**Langkah:**
```bash
# Folder takota sudah ada di:
cd takota-full-any/takota

# Verify struktur
ls -la

# Lanjut ke Quick Start (lihat di bawah)
```

### Opsi 2: Buat Manual dari Folder Terpisah

Jika ingin membuat sendiri atau butuh customize:

```bash
# 1. Buat folder baru
mkdir takota-new
cd takota-new

# 2. Copy backend ke root
cp -r ../takota-bacend/* .
cp -r ../takota-bacend/.* . 2>/dev/null || true

# 3. Copy frontend ke subfolder web
cp -r ../takota-frontend/takota-frontend ./web

# 4. Copy dokumentasi (jika ada)
cp ../takota/README_PROJECT.md .
cp ../takota/INSTALL.md .
cp ../takota/Makefile .
cp ../takota/start-*.sh .
# ... dll

# 5. Set permission untuk scripts
chmod +x start-*.sh
```

---

## 🚀 Quick Start (Setelah Migrasi)

### 1. Setup Environment

```bash
cd takota

# Copy environment file
cp .env.example .env

# Edit .env dengan konfigurasi Anda
nano .env
```

**Minimal required di .env:**
```env
SERVER_PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=takota_db
JWT_SECRET=your_secret_key_minimum_32_characters
S3_ENDPOINT=localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=takota-bucket
```

### 2. Install Dependencies

```bash
# Install semua (Go + npm)
make install

# Atau manual:
go mod tidy              # Backend
cd web && npm install    # Frontend
```

### 3. Setup Database

**Option A: Gunakan Docker (Recommended)**
```bash
# Start PostgreSQL + Redis + MinIO
make docker-up

# Check services
docker-compose ps
```

**Option B: PostgreSQL Lokal**
```bash
# Buat database
createdb takota_db

# Run migrations
psql -U postgres -d takota_db -f migrations/001_initial_schema.sql
psql -U postgres -d takota_db -f migrations/002_add_sign_status.sql
```

### 4. Run Application

```bash
# Run backend + frontend sekaligus
make dev

# Atau jalankan terpisah:
# Terminal 1:
make backend

# Terminal 2:
make frontend
```

### 5. Access & Test

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8080
- **Health Check**: http://localhost:8080/health

**Default Login:**
- Username: `admin`
- Password: `admin123`

---

## 🔍 Verifikasi Migrasi

### Checklist Backend

```bash
cd takota

# ✅ Check struktur folder
ls -la cmd internal pkg migrations templates

# ✅ Check Go files
ls internal/controllers/export_controller.go
ls internal/models/pdf_template.go
ls internal/utils/pdf_generator.go

# ✅ Check go.mod
grep chromedp go.mod

# ✅ Check template
ls templates/absensi_template.html

# ✅ Install dependencies
go mod tidy
go mod download

# ✅ Build test
go build cmd/api/main.go
```

### Checklist Frontend

```bash
cd takota/web

# ✅ Check struktur
ls -la src/admin/pages/AdminReports.jsx
ls -la src/admin/lib/api.js

# ✅ Check package.json
cat package.json

# ✅ Install dependencies
npm install

# ✅ Build test
npm run build
```

### Checklist Integration

```bash
cd takota

# ✅ Scripts executable
ls -la start-*.sh

# ✅ Makefile exists
cat Makefile

# ✅ Documentation exists
ls -la README*.md INSTALL.md PROJECT_STRUCTURE.md
```

---

## 🔄 Data Migration (Jika Sudah Ada Data)

### Database

Jika sudah punya database lama:

```bash
# 1. Backup database lama
pg_dump -U postgres takota_db > backup_old.sql

# 2. Restore ke database baru (jika beda database)
psql -U postgres new_takota_db < backup_old.sql

# 3. Atau gunakan database yang sama (update .env)
```

### Files (S3/MinIO)

Jika sudah ada file di storage lama:

**Option 1: Gunakan bucket yang sama**
```env
# Di .env, arahkan ke bucket lama
S3_ENDPOINT=your_old_endpoint
S3_BUCKET_NAME=your_old_bucket
```

**Option 2: Copy files ke bucket baru**
```bash
# Gunakan MinIO client (mc)
mc alias set old http://old-minio:9000 access_key secret_key
mc alias set new http://localhost:9000 minioadmin minioadmin

# Copy bucket
mc mirror old/old-bucket new/takota-bucket
```

---

## 🔧 Update Konfigurasi

### Backend (.env)

Pastikan semua environment variables sudah diset:

```bash
# Copy dari contoh
cp .env.example .env

# Atau migrate dari .env lama
cp ../takota-bacend/.env .

# Verifikasi
cat .env | grep -E "^[A-Z_]+" | wc -l  # Should be 20+
```

### Frontend

**Update Base URL (jika perlu):**

1. Buka http://localhost:5173
2. Login sebagai admin
3. Klik menu **Pengaturan** (ikon gear)
4. Set **Base URL** ke `http://localhost:8080` (atau URL backend Anda)
5. **Matikan Mock Mode**
6. Klik **Save**

---

## 🧪 Testing Migrasi

### 1. Test Backend API

```bash
# Health check
curl http://localhost:8080/health

# Login (dapatkan token)
curl -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -H "Key-Request: web" \
  -d '{"username":"admin","password":"admin123"}'

# Simpan token dari response
TOKEN="<token_dari_response>"

# Test endpoint lain
curl http://localhost:8080/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Key-Request: web"
```

### 2. Test Frontend

1. **Login**: http://localhost:5173
2. **User Dashboard**: Pastikan data muncul
3. **Admin Dashboard**: Cek statistik
4. **Rekap PDF**: Menu Laporan → Rekap & Unduh → Generate PDF

### 3. Test PDF Generation

```bash
# Test via curl (dengan token admin)
curl -X GET \
  "http://localhost:8080/api/admin/export/pdf?start_date=2024-07-01&end_date=2024-07-14&du_name=Test%20DU&du_address=Test%20Address" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Key-Request: web" \
  --output test.pdf

# Check file
file test.pdf  # Should be: PDF document
```

---

## 🐛 Troubleshooting Migrasi

### Error: "go: command not found"

```bash
# Install Go
wget https://go.dev/dl/go1.25.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.25.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
```

### Error: "npm: command not found"

```bash
# Install Node.js & npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Error: "chromedp: chrome not found"

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install chromium-browser

# Verify
which chromium || which chromium-browser
```

### Error: "database connection refused"

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Atau via Docker
docker-compose up -d postgres

# Check port
netstat -an | grep 5432
```

### Error: "permission denied: ./start-backend.sh"

```bash
# Set executable
chmod +x start-*.sh
```

### Error: Frontend tidak connect ke backend

1. **Check backend running:**
   ```bash
   curl http://localhost:8080/health
   ```

2. **Check frontend base URL:**
   - Buka browser console (F12)
   - Check network tab untuk API calls
   - Pastikan arahnya ke `http://localhost:8080`

3. **Disable mock mode:**
   - Admin → Pengaturan → Mock Mode OFF

### Error: "template not found"

```bash
# Check working directory
pwd

# Template harus di: <working_dir>/templates/absensi_template.html
ls templates/absensi_template.html

# Run dari folder yang benar
cd takota
go run cmd/api/main.go
```

---

## 📝 Post-Migration Checklist

### Development
- [ ] Backend running di port 8080
- [ ] Frontend running di port 5173
- [ ] Database connected
- [ ] Redis connected (optional)
- [ ] MinIO connected
- [ ] Chrome/Chromium installed
- [ ] All tests passing

### Configuration
- [ ] .env file configured
- [ ] Database migrations applied
- [ ] MinIO bucket created
- [ ] Frontend base URL set
- [ ] Mock mode disabled

### Features
- [ ] Login works (user & admin)
- [ ] Attendance works (check-in/out)
- [ ] Absence works (submit & approve)
- [ ] Photo upload works
- [ ] CSV export works
- [ ] **PDF export works** 🎯
- [ ] User management works

---

## 🚢 Production Deployment

Setelah migrasi dan testing berhasil:

```bash
# 1. Build production
make build

# Output:
# - Backend: bin/takota-api
# - Frontend: web/dist/

# 2. Deploy backend
scp bin/takota-api user@server:/opt/takota/
scp .env user@server:/opt/takota/
scp -r templates user@server:/opt/takota/

# 3. Deploy frontend
scp -r web/dist/* user@server:/var/www/takota/

# 4. Setup systemd (optional)
# Lihat INSTALL.md untuk detail
```

---

## 📊 Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Structure** | 2 separate folders | 1 unified folder |
| **Backend Path** | `takota-bacend/` | `takota/` (root) |
| **Frontend Path** | `takota-frontend/takota-frontend/` | `takota/web/` |
| **Documentation** | README only | 7+ detailed docs |
| **Scripts** | None | Makefile + 3 scripts |
| **PDF Export** | ❌ Not implemented | ✅ Fully integrated |
| **Ease of Use** | Manual setup | `make dev` |

---

## 🎓 Best Practices

### Development Workflow

```bash
# 1. Always work in takota/ folder
cd takota

# 2. Use Makefile commands
make dev          # Development
make build        # Production build
make test         # Run tests

# 3. Keep documentation updated
# Edit relevant .md files when adding features

# 4. Follow naming conventions
# See PROJECT_STRUCTURE.md
```

### Git Workflow

```bash
# 1. Initialize git (if not already)
cd takota
git init

# 2. Add .gitignore (already created)
git add .gitignore

# 3. First commit
git add .
git commit -m "Initial commit: Unified project structure"

# 4. Create repository & push
git remote add origin <your-repo-url>
git push -u origin main
```

---

## 📞 Need Help?

**Documentation:**
- Quick Start: `README_QUICK.md`
- Installation: `INSTALL.md`
- Structure: `PROJECT_STRUCTURE.md`
- Integration Summary: `INTEGRATION_SUMMARY.md`

**Common Issues:**
- See troubleshooting section di `INSTALL.md`
- Check logs: `docker-compose logs` atau `journalctl`

**Support:**
- Open issue di repository
- Check existing documentation

---

## ✅ Success Criteria

Migrasi dianggap **berhasil** jika:

1. ✅ Struktur folder sesuai `PROJECT_STRUCTURE.md`
2. ✅ Backend bisa dijalankan dengan `make backend`
3. ✅ Frontend bisa dijalankan dengan `make frontend`
4. ✅ Database terkoneksi
5. ✅ Login berhasil (user & admin)
6. ✅ Fitur attendance/absence berfungsi
7. ✅ **PDF export berfungsi** 🎯
8. ✅ Semua dokumentasi accessible

---

**Migration Version:** 1.0  
**Last Updated:** 10 Juli 2026  
**Next Review:** After deployment

**Good luck with the migration! 🚀**
