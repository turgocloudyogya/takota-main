# 📂 Struktur Project Takota

Dokumentasi lengkap struktur folder dan file dalam project Takota.

```
takota/
├── 📁 cmd/                          # Backend entry points
│   └── api/
│       └── main.go                  # Main application entry
│
├── 📁 internal/                     # Backend internal packages (private)
│   ├── config/
│   │   └── config.go                # Configuration management
│   ├── controllers/
│   │   ├── admin_controller.go      # Admin endpoints (attendance, absence list)
│   │   ├── admin_user_controller.go # User management endpoints
│   │   ├── all_controller.go        # Global/shared endpoints
│   │   ├── auth_controller.go       # Authentication endpoints
│   │   ├── export_controller.go     # CSV & PDF export endpoints
│   │   └── user_controller.go       # User/Student endpoints
│   ├── middlewares/
│   │   └── auth.go                  # JWT auth, role check, password change check
│   ├── models/
│   │   ├── attendance.go            # Attendance & absence model
│   │   ├── pdf_template.go          # PDF template data structures
│   │   └── user.go                  # User model
│   └── utils/
│       ├── helpers.go               # Helper functions (date, string, etc)
│       ├── pdf_generator.go         # PDF generation from HTML template
│       └── response.go              # Standardized API responses
│
├── 📁 pkg/                          # Backend public packages (reusable)
│   ├── database/
│   │   └── database.go              # GORM PostgreSQL connection
│   ├── jwt/
│   │   └── jwt.go                   # JWT token generation & validation
│   ├── redis/
│   │   └── redis.go                 # Redis client setup
│   └── s3/
│       └── s3.go                    # MinIO/S3 client & operations
│
├── 📁 migrations/                   # Database migration scripts
│   ├── 001_initial_schema.sql       # Initial database schema
│   └── 002_add_sign_status.sql      # Add sign_status field
│
├── 📁 templates/                    # HTML templates
│   └── absensi_template.html        # Attendance recap PDF template
│
├── 📁 web/                          # Frontend React application
│   ├── 📁 public/                   # Static assets
│   │   └── favicon.ico
│   │
│   ├── 📁 src/
│   │   ├── 📁 admin/                # Admin dashboard
│   │   │   ├── 📁 components/       # Admin UI components
│   │   │   │   ├── FormField.jsx
│   │   │   │   ├── ListChrome.jsx
│   │   │   │   ├── Modals.jsx
│   │   │   │   ├── PageHeader.jsx
│   │   │   │   ├── StatCard.jsx
│   │   │   │   ├── StatusChip.jsx
│   │   │   │   └── UserFormModal.jsx
│   │   │   │
│   │   │   ├── 📁 lib/              # Admin utilities & API
│   │   │   │   ├── api.js           # API client (fetch wrapper)
│   │   │   │   ├── csvTemplate.js   # CSV export helper
│   │   │   │   ├── dateWindow.js    # Date range utilities
│   │   │   │   ├── mockData.js      # Mock data for development
│   │   │   │   ├── normalize.js     # API response normalizer
│   │   │   │   └── session.js       # Session & token management
│   │   │   │
│   │   │   ├── 📁 pages/            # Admin pages
│   │   │   │   ├── AdminAbsence.jsx    # Absence management
│   │   │   │   ├── AdminApiTester.jsx  # API testing tool
│   │   │   │   ├── AdminAttendance.jsx # Attendance list
│   │   │   │   ├── AdminDashboard.jsx  # Dashboard & stats
│   │   │   │   ├── AdminLogin.jsx      # Admin login & settings
│   │   │   │   ├── AdminReports.jsx    # Recap & PDF export ⭐
│   │   │   │   └── AdminUsers.jsx      # User management
│   │   │   │
│   │   │   └── AdminLayout.jsx      # Admin layout wrapper
│   │   │
│   │   ├── 📁 components/           # User UI components
│   │   │   ├── AbsenceRow.jsx
│   │   │   ├── AttendanceSheet.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   ├── PhotoGalleryEmptyState.jsx
│   │   │   └── PhotoPreviewModal.jsx
│   │   │
│   │   ├── 📁 lib/                  # User utilities
│   │   │   ├── location.js          # Geolocation helpers
│   │   │   └── mockData.js          # Mock data
│   │   │
│   │   ├── 📁 pages/                # User pages
│   │   │   ├── Absence.jsx          # Submit absence/sick request
│   │   │   ├── Attendance.jsx       # Check-in/check-out
│   │   │   ├── ChangePassword.jsx   # Change password
│   │   │   ├── Login.jsx            # User login
│   │   │   ├── Main.jsx             # Home/dashboard
│   │   │   └── Photos.jsx           # Photo gallery
│   │   │
│   │   ├── App.jsx                  # Main app router
│   │   ├── index.css                # Global styles
│   │   └── main.jsx                 # React entry point
│   │
│   ├── .gitignore                   # Git ignore (frontend)
│   ├── eslint.config.js             # ESLint config
│   ├── index.html                   # HTML entry point
│   ├── package.json                 # npm dependencies
│   ├── package-lock.json            # npm lock file
│   ├── README.md                    # Frontend README
│   └── vite.config.js               # Vite config
│
├── 📄 .dockerignore                 # Docker ignore
├── 📄 .env.example                  # Environment variables template
├── 📄 .gitignore                    # Git ignore (combined)
├── 📄 docker-compose.yml            # Docker services setup
├── 📄 Dockerfile                    # Backend Docker image
├── 📄 go.mod                        # Go module definition
├── 📄 go.sum                        # Go dependencies checksum
├── 📄 INSTALL.md                    # Installation guide ⭐
├── 📄 Makefile                      # Build & dev commands ⭐
├── 📄 README.md                     # Backend README (original)
├── 📄 README_PROJECT.md             # Project overview ⭐
├── 📄 start-all.sh                  # Start backend + frontend ⭐
├── 📄 start-backend.sh              # Start backend only ⭐
└── 📄 start-frontend.sh             # Start frontend only ⭐

⭐ = File baru yang ditambahkan saat integrasi
```

---

## 📋 Deskripsi Folder Utama

### Backend

#### `cmd/`
Entry points untuk aplikasi Go. Setiap subfolder adalah executable berbeda.
- `cmd/api/main.go`: Server HTTP API utama

#### `internal/`
Package internal yang hanya bisa diakses dalam project ini (Go convention).

**`internal/controllers/`**
- HTTP handlers untuk setiap endpoint
- Mengikuti pattern: satu controller per domain/resource
- Naming: `{domain}_controller.go`

**`internal/middlewares/`**
- JWT authentication
- Role-based access control (RBAC)
- Password change enforcement
- Request key validation

**`internal/models/`**
- Database models (GORM)
- Data structures untuk templates
- Request/Response DTOs

**`internal/utils/`**
- Helper functions (tidak spesifik ke domain)
- PDF generation utilities
- API response formatters

#### `pkg/`
Package publik yang bisa di-import oleh project lain.

**`pkg/database/`**
- Database connection management
- GORM initialization

**`pkg/jwt/`**
- JWT token generation
- Token validation & parsing

**`pkg/redis/`**
- Redis client setup
- Cache utilities

**`pkg/s3/`**
- MinIO/S3 operations
- File upload/download
- Pre-signed URL generation

#### `migrations/`
SQL migration files, dijalankan secara berurutan.

#### `templates/`
Go `html/template` files untuk PDF generation.

---

### Frontend

#### `web/src/admin/`
Admin dashboard lengkap dengan:
- **pages/**: Halaman-halaman admin
  - `AdminReports.jsx`: **Fitur rekap & unduh PDF** 🎯
  - `AdminAttendance.jsx`: List presensi
  - `AdminAbsence.jsx`: List & approve izin
  - `AdminUsers.jsx`: Kelola user
  - `AdminDashboard.jsx`: Dashboard & statistik
  
- **components/**: Reusable UI components
- **lib/api.js**: API client dengan fungsi `exportAttendancePDF()` 🎯

#### `web/src/pages/`
User/student pages:
- `Attendance.jsx`: Check-in/check-out
- `Absence.jsx`: Ajukan izin/sakit
- `Photos.jsx`: Gallery foto
- `Main.jsx`: Dashboard siswa

#### `web/src/components/`
Shared UI components untuk user pages.

---

## 🔄 Data Flow

### Attendance/Absence Creation
```
Frontend (Attendance.jsx)
    ↓ POST /api/user/attendance
Backend (user_controller.go)
    ↓ Save to DB
    ↓ Upload photo to S3
Database (attendance table)
```

### PDF Export Flow
```
Frontend (AdminReports.jsx)
    ↓ GET /api/admin/export/pdf?start_date=...&student_ids=...
Backend (export_controller.go)
    ↓ Query attendance data
    ↓ Build PDFTemplateData struct
    ↓ Render HTML template
    ↓ Convert HTML → PDF (chromedp)
    ↓ Return PDF binary
Frontend
    ↓ Download PDF file
```

### Authentication Flow
```
Frontend (Login.jsx)
    ↓ POST /api/auth {username, password}
Backend (auth_controller.go)
    ↓ Validate credentials
    ↓ Generate JWT token
    ↓ Return {token, user_info}
Frontend
    ↓ Store token in localStorage
    ↓ Include in Authorization header for subsequent requests
```

---

## 🗄️ Database Schema

### `users` table
```sql
- id (uuid, PK)
- username (varchar, unique)
- password (varchar, hashed)
- nickname (varchar)
- callname (varchar)
- type (varchar) → 'admin' | 'user'
- change_as_login (boolean)
- last_login (timestamptz)
- created_at, updated_at
```

### `attendance` table
```sql
- id (uuid, PK)
- user_id (uuid, FK → users.id)
- type (varchar) → 'attendance' | 'absence'
- option (varchar) → 'sick' | 'absence' | 'alpha' (for absence type)
- reason (text)
- photo (varchar) → S3 key
- file (varchar) → S3 key (untuk surat izin)
- latitude, longitude (varchar)
- gmaps_embed (text)
- verify_by (uuid, FK → users.id)
- sign_status (varchar) → 'allow' | 'reject' | NULL
- created_at, updated_at
```

---

## 🔐 Environment Variables

Lihat `.env.example` untuk list lengkap. Key variables:

**Server:**
- `SERVER_PORT` - Port backend (default: 8080)
- `GIN_MODE` - Gin mode (debug/release)

**Database:**
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

**JWT:**
- `JWT_SECRET` - Secret key untuk signing token

**S3/MinIO:**
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`

**Redis:**
- `REDIS_URL` atau `REDIS_HOST` + `REDIS_PORT`

---

## 🚀 Scripts & Commands

### Makefile Commands
```bash
make help         # Lihat semua commands
make install      # Install dependencies
make dev          # Run backend + frontend
make build        # Build untuk production
make docker-up    # Start Docker services
make test         # Run tests
make clean        # Clean build artifacts
```

### Shell Scripts
```bash
./start-all.sh      # Start backend + frontend (background)
./start-backend.sh  # Start backend only
./start-frontend.sh # Start frontend only
```

---

## 📦 Dependencies

### Backend (Go)
- **gin**: Web framework
- **gorm**: ORM
- **jwt-go**: JWT authentication
- **chromedp**: Headless Chrome (PDF generation) 🆕
- **minio-go**: S3/MinIO client
- **go-redis**: Redis client
- **uuid**: UUID generation

### Frontend (React)
- **react**: UI library
- **vite**: Build tool & dev server
- **@heroui/react**: UI component library
- **@gravity-ui/uikit**: Additional UI components
- **sonner**: Toast notifications

---

## 🎨 Styling & UI

- **CSS Framework**: Tailwind CSS (utility-first)
- **Component Library**: HeroUI + Gravity UI
- **Icons**: Gravity UI Icons
- **Font**: System fonts (Arial, Helvetica, sans-serif)

---

## 🔄 Development Workflow

1. **Backend changes:**
   ```bash
   # Edit Go files
   # Server auto-reload dengan air (optional)
   go run cmd/api/main.go
   ```

2. **Frontend changes:**
   ```bash
   cd web
   # Vite hot-reload otomatis
   npm run dev
   ```

3. **Database changes:**
   ```bash
   # Buat migration file baru
   touch migrations/003_your_migration.sql
   # Edit SQL
   # Apply manual atau via tool
   ```

4. **Template changes:**
   ```bash
   # Edit templates/absensi_template.html
   # Test via admin UI → Rekap & Unduh
   ```

---

## 📝 Naming Conventions

### Backend (Go)
- **Files**: `snake_case.go`
- **Packages**: `lowercase`, singular
- **Structs**: `PascalCase`
- **Functions**: `PascalCase` (exported), `camelCase` (private)
- **Variables**: `camelCase`

### Frontend (JS/JSX)
- **Files**: `PascalCase.jsx` (components), `camelCase.js` (utils)
- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

---

Untuk pertanyaan lebih lanjut, lihat:
- [INSTALL.md](INSTALL.md) - Panduan instalasi
- [README_PROJECT.md](README_PROJECT.md) - Overview project
- [README.md](README.md) - Backend documentation (original)
