# 📚 Index Dokumentasi Takota

Selamat datang! Pilih dokumentasi sesuai kebutuhan Anda:

---

## 🚀 Quick Start

**Baru pertama kali? Mulai dari sini:**

### 1️⃣ [RUNNING.md](RUNNING.md) ⭐ **BACA INI DULU**
Panduan lengkap cara menjalankan backend & frontend dengan 4 metode berbeda:
- ✅ Development dengan Make (recommended)
- ✅ Manual tanpa Make
- ✅ Docker Compose all-in-one
- ✅ Production build

**Quick command:**
```bash
make setup     # Setup .env
make install   # Install dependencies
make docker-up # Start services
make dev       # Run backend + frontend
```

---

## 📖 Dokumentasi Utama

### [README.md](README.md)
Overview lengkap project:
- ✨ Features & capabilities
- 🛠️ Tech stack
- 🏗️ Architecture diagram
- 📡 API endpoints overview
- 🔒 Security features

### [INSTALL.md](INSTALL.md)
Panduan instalasi detail:
- Prerequisites installation
- Environment configuration
- Database setup
- Troubleshooting instalasi

---

## 🔵 Development

### [QUICK_START_DEV.md](QUICK_START_DEV.md)
Development setup cepat dengan Make commands dan hot reload

---

## 🟢 Production

### [QUICK_START_PROD.md](QUICK_START_PROD.md)
Production deployment guide

### [DEPLOYMENT_STRATEGIES.md](DEPLOYMENT_STRATEGIES.md)
Strategi deployment production:
- Docker deployment
- Native binary deployment
- Hybrid approach
- Nginx reverse proxy
- SSL/TLS setup

---

## 📂 Project Info
### [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
Struktur folder dan arsitektur project:
- Folder structure detail
- Component organization
- Data flow

### [CHANGELOG.md](CHANGELOG.md)
Version history dan update log

---

## 🛠️ Common Commands

### Development
```bash
make install      # Install all dependencies
make dev          # Run backend + frontend (hot reload)
make backend      # Run backend only
make frontend     # Run frontend only
```

### Docker
```bash
make docker-up    # Start PostgreSQL, Redis, MinIO
make docker-down  # Stop services
make docker-logs  # View logs
```

### Build & Test
```bash
make build        # Build production binary + static files
make test         # Run tests
make clean        # Clean build artifacts
```

### Utility
```bash
make check        # Check system requirements
make setup        # Create .env from .env.example
make help         # Show all commands
```

---

## 🎯 Quick Navigation

**"Bagaimana cara menjalankan aplikasi?"**  
→ [RUNNING.md](RUNNING.md) ⭐

**"Cara install dari awal?"**  
→ [INSTALL.md](INSTALL.md)

**"Struktur project seperti apa?"**  
→ [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

**"Deploy ke production?"**  
→ [QUICK_START_PROD.md](QUICK_START_PROD.md) + [DEPLOYMENT_STRATEGIES.md](DEPLOYMENT_STRATEGIES.md)

**"Apa saja yang berubah?"**  
→ [CHANGELOG.md](CHANGELOG.md)

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Takota Application                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  Frontend (React + Vite)                        │
│  ┌──────────────────┐                          │
│  │  Web Interface   │  :5173 (dev)             │
│  │  (Static Files)  │  :8080 (prod)            │
│  └────────┬─────────┘                          │
│           │                                     │
│           │ HTTP/HTTPS                          │
│           ▼                                     │
│  ┌──────────────────┐                          │
│  │  Backend (Go)    │  :8080                   │
│  │  API Server      │                          │
│  └────┬─────────────┘                          │
│       │                                         │
│       ├─► PostgreSQL :5432 (Database)          │
│       ├─► Redis      :6379 (Cache, optional)   │
│       └─► MinIO      :9000 (S3 Storage)        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📖 Reading Order

### 🆕 First Time Setup
1. [RUNNING.md](RUNNING.md) - **START HERE**
2. [README.md](README.md) - Overview features
3. [INSTALL.md](INSTALL.md) - Detail instalasi
4. Start coding! 🚀

### 🚀 Development
1. [RUNNING.md](RUNNING.md) - Cara run dev environment
2. [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Pahami struktur code
3. [QUICK_START_DEV.md](QUICK_START_DEV.md) - Dev workflow

### 📦 Production Deployment
1. [QUICK_START_PROD.md](QUICK_START_PROD.md) - Production checklist
2. [DEPLOYMENT_STRATEGIES.md](DEPLOYMENT_STRATEGIES.md) - Deployment options
3. [RUNNING.md - Metode 4](RUNNING.md#metode-4-production-build) - Build production

---

## 🗂️ File Structure

```
takota-app/
│
├── 📚 Documentation
│   ├── RUNNING.md              ⭐ Cara menjalankan aplikasi
│   ├── README.md               📖 Overview & features
│   ├── DOCS_INDEX.md           📑 Index ini
│   ├── INSTALL.md              📦 Installation guide
│   ├── QUICK_START_DEV.md      🔵 Development quick start
│   ├── QUICK_START_PROD.md     🟢 Production quick start
│   ├── DEPLOYMENT_STRATEGIES.md 🚀 Deployment strategies
│   ├── PROJECT_STRUCTURE.md    📂 Project structure
│   └── CHANGELOG.md            📝 Version history
│
├── 🔧 Backend (Go)
│   ├── cmd/api/                Entry point
│   ├── internal/               Core application
│   │   ├── controllers/        HTTP handlers
│   │   ├── models/            Data models
│   │   ├── middlewares/       Auth, etc.
│   │   └── utils/             Helpers
│   ├── pkg/                   Shared packages
│   ├── migrations/            Database migrations
│   └── templates/             HTML templates
│
├── 🎨 Frontend (React)
│   └── web/
│       ├── src/               Source code
│       │   ├── admin/        Admin dashboard
│       │   ├── pages/        User pages
│       │   └── components/   Shared components
│       └── dist/             Build output (generated)
│
├── 🐳 Configuration
│   ├── Makefile               Build commands
│   ├── docker-compose.yml     Docker services
│   ├── .env.example          Config template
│   └── start-*.sh            Helper scripts
│
└── 📦 Dependencies
    ├── go.mod                Go dependencies
    └── web/package.json      npm dependencies
```

---

## 🤝 Contributing

Contribution welcome! Steps:
1. Fork repository
2. Read [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
3. Create feature branch
4. Commit changes
5. Update [CHANGELOG.md](CHANGELOG.md)
6. Open Pull Request

---

## 📞 Need Help?

### Troubleshooting
- [RUNNING.md - Troubleshooting](RUNNING.md#troubleshooting) - Common issues & fixes
- [INSTALL.md - Troubleshooting](INSTALL.md#troubleshooting) - Installation problems

### Logs
```bash
# View logs
docker-compose logs -f         # All services
docker-compose logs -f api     # Backend only
docker-compose logs -f postgres # Database only
```

### Health Check
```bash
# Check if backend is running
curl http://localhost:8080/health

# Should return: {"status":"OK"}
```

---

## 📚 External Resources

- **Go**: https://go.dev/doc/
- **React**: https://react.dev/
- **Gin Framework**: https://gin-gonic.com/docs/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Docker**: https://docs.docker.com/

---

**Last Updated**: 18 Juli 2026  
**Version**: 1.0.0

**Happy Coding! 🚀**

