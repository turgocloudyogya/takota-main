# 🎓 Takota - Sistem Presensi & Absensi

> **Takota** adalah aplikasi presensi dan absensi terintegrasi untuk peserta didik dengan fitur rekap PDF otomatis.

[![Go Version](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go)](https://golang.org)
[![Node Version](https://img.shields.io/badge/Node-16+-339933?logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ⚡ Quick Start

```bash
# 1. Setup environment
make setup

# 2. Install dependencies
make install

# 3. Start services
make docker-up  # PostgreSQL, Redis, MinIO

# 4. Run application
make dev        # Backend + Frontend
```

**Akses aplikasi:**
- 🌐 Frontend: http://localhost:5173
- 🔧 Backend: http://localhost:8080

---

## 📚 Dokumentasi

| Dokumen | Deskripsi |
|---------|-----------|
| **[INSTALL.md](INSTALL.md)** | 📦 Panduan instalasi lengkap |
| **[README_PROJECT.md](README_PROJECT.md)** | 📖 Overview project & fitur |
| **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** | 📂 Struktur folder detail |
| **[CHANGELOG.md](CHANGELOG.md)** | 📝 Riwayat perubahan |
| **[TESTING_PDF_FEATURE.md](TESTING_PDF_FEATURE.md)** | 🧪 Testing fitur PDF |

---

## ✨ Fitur Utama

### 👨‍🎓 User (Siswa)
- ✅ Absensi dengan foto & lokasi GPS
- ✅ Ajukan izin/sakit dengan upload surat
- ✅ Riwayat kehadiran
- ✅ Galeri foto presensi

### 👨‍💼 Admin
- ✅ Dashboard statistik real-time
- ✅ Kelola data siswa (CRUD)
- ✅ Monitor & verifikasi presensi
- ✅ Approve/reject pengajuan izin
- ✅ **Export CSV & PDF** 🆕
- ✅ **Generate rekap daftar hadir** 🆕

### 🎯 Fitur PDF Baru!

Generate rekap "Daftar Hadir Peserta Didik" dalam format PDF:
- 📄 Format A4 Landscape
- 📅 Periode 2 minggu (auto pagination)
- ✅ Tanda: V (hadir), S (sakit), I (izin), A (alpha)
- 🏢 Info DU/DI & tanda tangan
- 👥 Filter siswa yang dimasukkan

**Preview:**
```
┌─────────────────────────────────────────────────┐
│  Nama DU/DI    : PT Sinar Abadi                 │
│  Alamat DU/DI  : Jl. Industri No. 12            │
├────┬──────────┬───┬───┬───┬───┬───┬───┬───┬───┤
│ No │   Nama   │ S │ S │ R │ K │ J │... │ S │...│
│    │          │ 1 │ 2 │ 3 │ 4 │ 5 │   │ I │ A │
├────┼──────────┼───┼───┼───┼───┼───┼───┼───┼───┤
│ 1  │ Ahmad    │ V │ V │ S │ V │ V │...│ 1 │ 0 │
│ 2  │ Budi     │ V │ I │ V │ V │ V │...│ 0 │ 1 │
└────┴──────────┴───┴───┴───┴───┴───┴───┴───┴───┘
```

---

## 🛠️ Tech Stack

### Backend
- **Go** 1.25+ - Bahasa pemrograman
- **Gin** - Web framework
- **GORM** - ORM
- **PostgreSQL** - Database
- **Redis** - Cache
- **MinIO/S3** - File storage
- **chromedp** - PDF generation 🆕

### Frontend
- **React** 18 - UI library
- **Vite** - Build tool
- **HeroUI** - Component library
- **Tailwind CSS** - Styling

---

## 🏗️ Struktur Project

```
takota/
├── cmd/              # Backend entry point
├── internal/         # Backend logic (controllers, models, utils)
├── pkg/              # Reusable packages (db, jwt, s3, redis)
├── migrations/       # Database migrations
├── templates/        # HTML templates (PDF)
├── web/              # Frontend React app
├── Makefile          # Build commands
└── *.sh              # Helper scripts
```

---

## 📦 Makefile Commands

```bash
make help           # Lihat semua commands
make check          # Cek system requirements
make install        # Install semua dependencies
make dev            # Run backend + frontend
make backend        # Run backend saja
make frontend       # Run frontend saja
make build          # Build untuk production
make docker-up      # Start Docker services
make docker-down    # Stop Docker services
make test           # Run semua tests
make clean          # Clean build artifacts
```

---

## 🚀 Development

### Run Backend
```bash
./start-backend.sh
# atau
make backend
# atau
go run cmd/api/main.go
```

### Run Frontend
```bash
./start-frontend.sh
# atau
make frontend
# atau
cd web && npm run dev
```

### Run Both
```bash
./start-all.sh
# atau
make dev
```

---

## 🐳 Docker

```bash
# Start services (PostgreSQL + Redis + MinIO)
make docker-up

# Stop services
make docker-down

# View logs
make docker-logs
```

**Services:**
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO: `localhost:9000` (Console: `9001`)

---

## 🔧 Konfigurasi

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`:**
   ```env
   SERVER_PORT=8080
   DB_HOST=localhost
   DB_PASSWORD=your_password
   JWT_SECRET=your_secret_key
   S3_ENDPOINT=localhost:9000
   # ... lihat .env.example untuk lengkapnya
   ```

3. **Run migrations:**
   ```bash
   psql -U postgres -d takota_db -f migrations/001_initial_schema.sql
   psql -U postgres -d takota_db -f migrations/002_add_sign_status.sql
   ```

---

## 🧪 Testing

```bash
# All tests
make test

# Backend only
make test-backend

# Frontend only
make test-frontend
```

**Test PDF Feature:**
1. Login sebagai admin di http://localhost:5173
2. Menu **Laporan → Rekap & Unduh**
3. Pilih periode & siswa
4. Klik "Buat & Unduh PDF"

---

## 📖 API Endpoints

### Auth
- `POST /api/auth` - Login
- `POST /api/auth-chpw` - Change password

### User
- `GET /api/user/home` - Home data
- `POST /api/user/attendance` - Check-in/out
- `POST /api/user/absence` - Submit absence

### Admin
- `GET /api/admin/attendances` - List presensi
- `GET /api/admin/absences` - List izin
- `GET /api/admin/users` - List users
- `POST /api/admin/user` - Create user
- `GET /api/admin/export` - Export CSV
- `GET /api/admin/export/pdf` - Export PDF 🆕

[Detail lengkap di README.md]

---

## ⚠️ Requirements

- **Go** 1.25+
- **Node.js** 16+ & npm
- **PostgreSQL** 13+
- **Chrome/Chromium** (untuk PDF)
- **Docker** (optional)

```bash
# Cek requirements
make check
```

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

---

## 🐛 Troubleshooting

**Chrome tidak ditemukan:**
```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser
```

**Port sudah digunakan:**
```bash
# Cek & kill process
lsof -i :8080
kill -9 <PID>
```

**Database error:**
```bash
# Start PostgreSQL
sudo systemctl start postgresql
```

[Lihat INSTALL.md untuk troubleshooting lengkap]

---

## 📄 License

[Specify your license]

---

## 📞 Support

- 📖 Dokumentasi: Lihat folder docs/
- 🐛 Issues: Buka issue di repository
- 💬 Diskusi: [Link forum/discord]

---

## 🎯 Roadmap

- [ ] Email notifications
- [ ] Mobile app (React Native)
- [ ] Face recognition
- [ ] QR code check-in
- [ ] Excel export
- [ ] Multi-location support
- [ ] Shift scheduling

---

**Made with ❤️ using Go & React**

**Happy Coding! 🚀**
