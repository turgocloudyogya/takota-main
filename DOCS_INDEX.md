# 📚 Dokumentasi Takota - Index

Selamat datang di dokumentasi project Takota! Berikut adalah panduan lengkap untuk menggunakan, mengembangkan, dan men-deploy aplikasi ini.

---

## 🚀 Mulai Cepat

Baru menggunakan Takota? Mulai dari sini:

1. **[README_QUICK.md](README_QUICK.md)** 📖
   - Quick reference & cheat sheet
   - Command shortcuts
   - Fitur overview

2. **[INSTALL.md](INSTALL.md)** 📦
   - Panduan instalasi lengkap
   - Step-by-step setup
   - Troubleshooting common issues

3. **Run:**
   ```bash
   make install  # Install dependencies
   make dev      # Start application
   ```

---

## 📂 Dokumentasi Lengkap

### Untuk Developer

| Dokumen | Deskripsi | Kapan Digunakan |
|---------|-----------|-----------------|
| **[README_PROJECT.md](README_PROJECT.md)** | Overview project & features | First time reading |
| **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** | Struktur folder detail | Understanding codebase |
| **[INSTALL.md](INSTALL.md)** | Installation guide | Setting up project |
| **[TESTING_PDF_FEATURE.md](TESTING_PDF_FEATURE.md)** | Testing PDF feature | Testing exports |

### Untuk Administrator

| Dokumen | Deskripsi | Kapan Digunakan |
|---------|-----------|-----------------|
| **[INSTALL.md](INSTALL.md)** | Installation & configuration | Server setup |
| **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** | Migration from old structure | Upgrading |
| **[CHANGELOG.md](CHANGELOG.md)** | Version history | Tracking changes |

### Untuk Project Manager

| Dokumen | Deskripsi | Kapan Digunakan |
|---------|-----------|-----------------|
| **[README_QUICK.md](README_QUICK.md)** | Quick overview | Demo & presentation |
| **[INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)** | Integration details | Review progress |
| **[CHANGELOG.md](CHANGELOG.md)** | What's new | Planning updates |

---

## 🗂️ Struktur Dokumentasi

```
takota/
├── 📘 README.md                    # Backend README (original)
├── 📗 README_PROJECT.md            # Main project overview
├── 📙 README_QUICK.md              # Quick reference
├── 📦 INSTALL.md                   # Installation guide
├── 📂 PROJECT_STRUCTURE.md         # Folder structure
├── 🔄 MIGRATION_GUIDE.md           # Migration from old structure
├── 📝 CHANGELOG.md                 # Version history
├── 🎯 INTEGRATION_SUMMARY.md       # Integration details
├── 🧪 TESTING_PDF_FEATURE.md       # PDF testing guide
└── 📚 DOCS_INDEX.md                # This file (index)
```

---

## 🎯 Quick Navigation

### I. Setup & Installation

**"Saya ingin install project ini"**
→ [INSTALL.md](INSTALL.md)

**"Apa saja requirements yang dibutuhkan?"**
→ [INSTALL.md - Prerequisites](INSTALL.md#prerequisites)

**"Bagaimana cara run development?"**
→ [INSTALL.md - Quick Start](INSTALL.md#quick-start)

### II. Development

**"Bagaimana struktur folder project ini?"**
→ [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

**"Dimana file untuk fitur X?"**
→ [PROJECT_STRUCTURE.md - Deskripsi Folder](PROJECT_STRUCTURE.md#deskripsi-folder-utama)

**"Bagaimana flow data dari frontend ke backend?"**
→ [PROJECT_STRUCTURE.md - Data Flow](PROJECT_STRUCTURE.md#data-flow)

### III. Features

**"Apa saja fitur yang tersedia?"**
→ [README_QUICK.md - Fitur Utama](README_QUICK.md#fitur-utama)

**"Bagaimana cara generate PDF?"**
→ [TESTING_PDF_FEATURE.md](TESTING_PDF_FEATURE.md)

**"Apa saja endpoint API?"**
→ [README_QUICK.md - API Endpoints](README_QUICK.md#api-endpoints)

### IV. Migration & Updates

**"Cara migrate dari struktur lama?"**
→ [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)

**"Apa yang berubah di versi terbaru?"**
→ [CHANGELOG.md](CHANGELOG.md)

**"Bagaimana proses integrasi dilakukan?"**
→ [INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)

### V. Troubleshooting

**"Error saat install dependencies"**
→ [INSTALL.md - Troubleshooting](INSTALL.md#troubleshooting)

**"PDF generation tidak berfungsi"**
→ [TESTING_PDF_FEATURE.md - Troubleshooting](TESTING_PDF_FEATURE.md#troubleshooting)

**"Database connection error"**
→ [INSTALL.md - Troubleshooting](INSTALL.md#troubleshooting)

---

## 📊 Diagram Project

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Takota System                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend (React)          Backend (Go)                 │
│  ┌──────────────┐          ┌──────────────┐            │
│  │              │  HTTP    │              │            │
│  │  Web UI      │◄────────►│  API Server  │            │
│  │  (Vite)      │  8080    │  (Gin)       │            │
│  └──────────────┘          └──────┬───────┘            │
│       :5173                       │                     │
│                                   │                     │
│                    ┌──────────────┼──────────────┐      │
│                    │              │              │      │
│              ┌─────▼─────┐  ┌────▼────┐  ┌─────▼─────┐│
│              │PostgreSQL │  │  Redis  │  │   MinIO   ││
│              │ (Data)    │  │ (Cache) │  │  (Files)  ││
│              └───────────┘  └─────────┘  └───────────┘│
│                  :5432         :6379         :9000     │
└─────────────────────────────────────────────────────────┘
```

### Request Flow (PDF Export)

```
User Browser
    │
    │ 1. Click "Buat & Unduh PDF"
    ▼
Frontend (AdminReports.jsx)
    │
    │ 2. GET /api/admin/export/pdf?start_date=...&student_ids=...
    ▼
Backend (export_controller.go)
    │
    ├─► 3. Query attendance data
    │        │
    │        ▼
    │   PostgreSQL
    │        │
    │        │ Return attendance records
    │        ▼
    │   Format to PDFTemplateData
    │
    ├─► 4. Render HTML template
    │        │
    │        ▼
    │   absensi_template.html
    │        │
    │        │ Return rendered HTML
    │        ▼
    │   HTML string
    │
    ├─► 5. Convert HTML → PDF
    │        │
    │        ▼
    │   chromedp (Chrome headless)
    │        │
    │        │ Return PDF bytes
    │        ▼
    │   PDF binary
    │
    └─► 6. Send PDF response
         │
         ▼
Frontend receives PDF
    │
    │ 7. Browser auto-download
    ▼
User gets PDF file
```

### Folder Structure

```
takota/
│
├── Backend (Root Level)
│   ├── cmd/              Entry points
│   ├── internal/         Core logic
│   │   ├── controllers/  HTTP handlers
│   │   ├── models/       Data structures
│   │   ├── middlewares/  HTTP middlewares
│   │   └── utils/        Helpers
│   ├── pkg/              Reusable packages
│   ├── migrations/       DB migrations
│   └── templates/        HTML templates
│
├── Frontend (web/)
│   ├── src/
│   │   ├── admin/        Admin dashboard
│   │   │   ├── pages/    Admin pages
│   │   │   ├── lib/      Admin utilities
│   │   │   └── components/
│   │   ├── pages/        User pages
│   │   ├── components/   User components
│   │   └── lib/          User utilities
│   ├── public/           Static assets
│   └── dist/             Build output (generated)
│
├── Documentation
│   ├── README*.md        Various READMEs
│   ├── INSTALL.md        Installation guide
│   ├── CHANGELOG.md      Version history
│   └── ...
│
└── Scripts & Config
    ├── Makefile          Build commands
    ├── start-*.sh        Helper scripts
    ├── .env.example      Config template
    ├── docker-compose.yml Docker setup
    └── .gitignore        Git ignore
```

---

## 🛠️ Common Commands

### Development
```bash
make install      # Install all dependencies
make dev          # Run backend + frontend
make backend      # Run backend only
make frontend     # Run frontend only
```

### Build
```bash
make build        # Build all
make build-backend   # Build backend only
make build-frontend  # Build frontend only
```

### Docker
```bash
make docker-up    # Start services
make docker-down  # Stop services
make docker-logs  # View logs
```

### Testing
```bash
make test         # Run all tests
make test-backend    # Backend tests
make test-frontend   # Frontend tests
```

### Utility
```bash
make check        # Check system requirements
make clean        # Clean build artifacts
make help         # Show all commands
```

---

## 📖 Reading Order (Recommended)

### For First-Time Setup:

1. **[README_QUICK.md](README_QUICK.md)** - Overview singkat
2. **[INSTALL.md](INSTALL.md)** - Setup environment
3. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Understand codebase
4. Start developing! 🚀

### For Migration from Old Structure:

1. **[INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)** - Understand changes
2. **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Migration steps
3. **[CHANGELOG.md](CHANGELOG.md)** - What's new
4. Testing & deployment

### For Feature Development:

1. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Find relevant files
2. **[README_QUICK.md](README_QUICK.md)** - Check existing features
3. Write code
4. Update **[CHANGELOG.md](CHANGELOG.md)**

---

## 🎓 Learning Resources

### Backend (Go)
- [Go Documentation](https://go.dev/doc/)
- [Gin Framework](https://gin-gonic.com/docs/)
- [GORM ORM](https://gorm.io/docs/)

### Frontend (React)
- [React Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/guide/)
- [HeroUI Components](https://heroui.com/)

### Database
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/docs/)

### Tools
- [Docker Documentation](https://docs.docker.com/)
- [chromedp](https://github.com/chromedp/chromedp)

---

## 🤝 Contributing

Tertarik untuk contribute? Baca:

1. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Pahami struktur
2. **[CHANGELOG.md](CHANGELOG.md)** - Cek rencana fitur
3. Fork → Branch → Commit → Push → Pull Request
4. Update documentation yang relevan

---

## 📞 Support & Help

### Documentation Issues
- Check **[INSTALL.md - Troubleshooting](INSTALL.md#troubleshooting)**
- Search in all .md files

### Technical Issues
- Check logs: `docker-compose logs` atau `journalctl`
- Enable debug mode: `GIN_MODE=debug` in .env
- Test individual components

### Feature Requests
- Check **[CHANGELOG.md - Upcoming Features](CHANGELOG.md#upcoming-features)**
- Open issue with detailed description

---

## 📝 Documentation Maintenance

### When to Update:

| Change | Update File |
|--------|-------------|
| New feature | CHANGELOG.md, README_QUICK.md |
| Bug fix | CHANGELOG.md |
| Config change | INSTALL.md, .env.example |
| Folder structure | PROJECT_STRUCTURE.md |
| API endpoint | README_QUICK.md |
| Migration step | MIGRATION_GUIDE.md |

### How to Update:

1. Edit relevant .md file
2. Keep formatting consistent
3. Add to CHANGELOG.md
4. Commit with clear message

---

## ✅ Documentation Checklist

Semua dokumentasi lengkap? Cek:

- [x] README_PROJECT.md - Overview & intro
- [x] README_QUICK.md - Quick reference
- [x] INSTALL.md - Installation guide
- [x] PROJECT_STRUCTURE.md - Folder structure
- [x] MIGRATION_GUIDE.md - Migration steps
- [x] INTEGRATION_SUMMARY.md - Integration details
- [x] CHANGELOG.md - Version history
- [x] TESTING_PDF_FEATURE.md - PDF testing
- [x] DOCS_INDEX.md - This index
- [x] Makefile - Build commands
- [x] start-*.sh - Helper scripts

**Status: ✅ Complete & Up-to-date**

---

## 📊 Documentation Statistics

- **Total Documents**: 10 files
- **Total Lines**: ~3500+ lines
- **Languages**: Markdown, Shell, Makefile
- **Last Updated**: 10 Juli 2026
- **Version**: 1.1.0

---

**Need specific help? Use Ctrl+F to search across all documentation!**

**Happy Reading & Coding! 📚🚀**
