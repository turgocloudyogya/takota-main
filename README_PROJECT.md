# Takota - Sistem Presensi & Absensi Terintegrasi

Project gabungan antara backend (Go) dan frontend (React) untuk sistem presensi dan absensi siswa dengan fitur rekap PDF.

## 📁 Struktur Project

```
takota/
├── cmd/                    # Backend entry points
│   └── api/               # Main API server
├── internal/              # Backend internal packages
│   ├── config/           # Konfigurasi aplikasi
│   ├── controllers/      # HTTP handlers
│   ├── middlewares/      # HTTP middlewares
│   ├── models/           # Database models & structs
│   └── utils/            # Helper functions
├── pkg/                   # Backend public packages
│   ├── database/         # Database connection
│   ├── jwt/              # JWT utilities
│   ├── redis/            # Redis client
│   └── s3/               # S3/MinIO client
├── migrations/            # Database migrations
├── templates/             # HTML templates (untuk PDF)
│   └── absensi_template.html
├── web/                   # Frontend React app
│   ├── src/              # Source code frontend
│   ├── public/           # Static assets
│   ├── package.json      # NPM dependencies
│   └── vite.config.js    # Vite configuration
├── docker-compose.yml     # Docker setup
├── Dockerfile            # Backend Docker image
├── go.mod                # Go dependencies
├── go.sum                # Go checksum
├── .env.example          # Environment variables template
└── README.md             # Backend README (original)

```

## 🚀 Quick Start

### Prerequisites

- **Go** 1.25+ (untuk backend)
- **Node.js** 16+ & npm (untuk frontend)
- **PostgreSQL** (database)
- **Redis** (optional, untuk caching)
- **MinIO/S3** (untuk file storage)
- **Chrome/Chromium** (untuk generate PDF)

### 1. Setup Backend

```bash
# Install dependencies
go mod tidy

# Copy environment file
cp .env.example .env

# Edit .env dengan konfigurasi database, redis, dan S3
nano .env

# Run migrations (jika perlu)
# Pastikan PostgreSQL sudah running

# Run backend server
go run cmd/api/main.go
```

Backend akan berjalan di **http://localhost:8080**

### 2. Setup Frontend

```bash
# Masuk ke folder web
cd web

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend akan berjalan di **http://localhost:5173** (atau port lain yang ditampilkan)

### 3. Setup Database & Services (Docker)

```bash
# Run PostgreSQL, Redis, dan MinIO dengan Docker
docker-compose up -d

# Cek services
docker-compose ps
```

## 🔧 Konfigurasi

### Backend (.env)

```env
# Server
SERVER_PORT=8080
GIN_MODE=release

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=takota

# JWT
JWT_SECRET=your_jwt_secret_key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# S3/MinIO
S3_ENDPOINT=localhost:9000
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BUCKET=takota-files
S3_USE_SSL=false
```

### Frontend

Frontend secara default akan terhubung ke backend di **http://localhost:8080**

Untuk mengubah base URL:
1. Login ke admin dashboard
2. Klik menu **Pengaturan**
3. Ubah **Base URL** sesuai kebutuhan

## ✨ Fitur Utama

### User (Siswa/Peserta Didik)
- ✅ Login dengan username/password
- ✅ Absensi masuk/pulang dengan foto & lokasi
- ✅ Ajukan izin/sakit dengan upload file
- ✅ Lihat riwayat kehadiran
- ✅ Galeri foto presensi

### Admin (Instruktur/Admin)
- ✅ Kelola data siswa (CRUD)
- ✅ Monitor presensi real-time
- ✅ Verifikasi pengajuan izin/sakit
- ✅ Export data CSV
- ✅ **Generate rekap PDF** (format Daftar Hadir Peserta Didik)
- ✅ Dashboard statistik

### Fitur Rekap PDF (Baru!)

Fitur rekap & unduh PDF menggunakan template `absensi_template.html`:
- Format A4 Landscape
- Tabel 12 hari per halaman
- Tanda kehadiran: V (hadir), S (sakit), I (izin), A (alpha)
- Total S/I/A per siswa
- Info DU/DI dan tanda tangan instruktur
- Otomatis pagination untuk periode > 12 hari

**Cara menggunakan:**
1. Login sebagai admin
2. Menu **Laporan → Rekap & Unduh**
3. Pilih periode (2 minggu)
4. Isi info DU/DI (opsional)
5. Pilih siswa yang ingin direkap
6. Klik "Buat & Unduh PDF"

## 🏗️ Build untuk Production

### Backend

```bash
# Build binary
go build -o bin/takota-api cmd/api/main.go

# Run binary
./bin/takota-api
```

### Frontend

```bash
cd web

# Build static files
npm run build

# Output akan ada di web/dist/
```

Untuk production, serve folder `web/dist/` menggunakan Nginx atau serve static files dari backend.

## 🐳 Docker Deployment

```bash
# Build dan run semua services
docker-compose up -d --build

# Lihat logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📚 API Documentation

API endpoints tersedia di:
- **Auth**: `/api/auth`, `/api/auth-chpw`
- **User**: `/api/user/*` (home, attendance, absence)
- **Admin**: `/api/admin/*` (users, attendances, absences, export)
- **Global**: `/api/all/*` (info, photos)

Detail lengkap ada di `README.md` (original backend README)

## 🧪 Testing

### Backend
```bash
# Run tests
go test ./...
```

### Frontend
```bash
cd web
npm run test
```

### Testing PDF Generation
Lihat file `TESTING_PDF_FEATURE.md` untuk panduan lengkap testing fitur PDF.

## 🛠️ Development

### Hot Reload Backend
```bash
# Install air (Go hot reload tool)
go install github.com/cosmtrek/air@latest

# Run dengan hot reload
air
```

### Hot Reload Frontend
```bash
cd web
npm run dev
```

## 📝 Migrasi Database

Migration files ada di folder `migrations/`:
- `001_initial_schema.sql` - Schema awal
- `002_add_sign_status.sql` - Tambah field sign_status

Jalankan migrations sesuai urutan atau gunakan migration tool seperti `golang-migrate`.

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

[Tentukan license project Anda]

## 👥 Authors

- Backend: Go + Gin + GORM + PostgreSQL
- Frontend: React + Vite + HeroUI + Gravity UI
- PDF Generation: chromedp + Go html/template

## 🐛 Troubleshooting

### Chrome/Chromium untuk PDF
```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser

# Fedora
sudo dnf install chromium

# macOS
brew install --cask chromium
```

### Port sudah digunakan
```bash
# Cek port yang digunakan
lsof -i :8080
lsof -i :5173

# Kill process
kill -9 <PID>
```

### Database connection error
- Pastikan PostgreSQL running
- Cek kredensial di `.env`
- Cek firewall/security group

### S3/MinIO connection error
- Pastikan MinIO/S3 running
- Cek endpoint dan credentials di `.env`
- Cek bucket sudah dibuat

## 📞 Support

Untuk bantuan dan pertanyaan, silakan buka issue di repository ini.

---

**Happy Coding! 🚀**
