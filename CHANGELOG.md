# Changelog

All notable changes to the Takota project will be documented in this file.

## [1.1.0] - 2026-07-10

### 🎉 Project Integration & PDF Export Feature

#### Added
- **PDF Export Feature** 🆕
  - Generate attendance recap PDF from `absensi_template.html`
  - Export endpoint: `GET /api/admin/export/pdf`
  - Support for 2-week period with automatic pagination
  - Configurable DU/DI name and address
  - Student selection filter
  - Attendance marks: V (hadir), S (sakit), I (izin), A (alpha)
  - A4 Landscape format with proper margins

- **Backend Components for PDF** 🆕
  - `internal/models/pdf_template.go` - PDF data structures
  - `internal/utils/pdf_generator.go` - HTML to PDF converter
  - `internal/controllers/export_controller.go` - ExportAttendancePDF handler

- **Project Integration** 🔄
  - Unified project structure: backend root + `web/` frontend
  - `Makefile` with common development commands
  - Shell scripts: `start-all.sh`, `start-backend.sh`, `start-frontend.sh`
  - Combined `.gitignore` for backend + frontend

- **Documentation** 📚
  - `README_PROJECT.md` - Main project overview
  - `INSTALL.md` - Comprehensive installation guide
  - `PROJECT_STRUCTURE.md` - Detailed folder structure documentation
  - `TESTING_PDF_FEATURE.md` - PDF feature testing guide

#### Changed
- **Frontend Structure**
  - Moved from `takota-frontend/takota-frontend/` to `web/`
  - `AdminReports.jsx` now calls real backend API (not mock)
  - API client ready to export PDF via `exportAttendancePDF()`

- **Backend Structure**
  - Enhanced `export_controller.go` with PDF generation
  - Added template function support (`inc`, `seq`) for HTML template
  - Route added: `admin.GET("/export/pdf", adminCtrl.ExportAttendancePDF)`

#### Fixed
- Template path resolution for PDF generation
- Date range query for attendance data (inclusive end date)
- Student filtering by UUID array

---

## [1.0.0] - Initial Release

### Backend Features
- ✅ User authentication with JWT
- ✅ Role-based access control (admin/user)
- ✅ Attendance check-in/check-out with photo & location
- ✅ Absence request submission with file upload
- ✅ Admin dashboard for monitoring
- ✅ User management (CRUD)
- ✅ Absence approval workflow
- ✅ CSV export for attendance data
- ✅ S3/MinIO integration for file storage
- ✅ Redis caching support
- ✅ PostgreSQL database with GORM

### Frontend Features
- ✅ User login & change password
- ✅ Attendance recording with camera & GPS
- ✅ Absence form submission
- ✅ Photo gallery
- ✅ Admin dashboard with statistics
- ✅ User management interface
- ✅ Attendance & absence list views
- ✅ API tester tool
- ✅ Mock mode for development

### Infrastructure
- ✅ Docker Compose setup (PostgreSQL, Redis, MinIO)
- ✅ Environment configuration support
- ✅ Database migrations
- ✅ Health check endpoint

---

## Migration Guide: Separate to Unified Project

If you have separate `takota-bacend` and `takota-frontend` folders:

### Manual Migration Steps

1. **Backup your data:**
   ```bash
   cp -r takota-bacend takota-bacend.backup
   cp -r takota-frontend takota-frontend.backup
   ```

2. **Create new structure:**
   ```bash
   mkdir takota
   cp -r takota-bacend/* takota/
   cp -r takota-bacend/.* takota/ 2>/dev/null || true
   cp -r takota-frontend/takota-frontend takota/web
   ```

3. **Update .env if needed:**
   ```bash
   cd takota
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Install dependencies:**
   ```bash
   cd takota
   make install
   ```

5. **Run migrations:**
   ```bash
   psql -U postgres -d takota_db -f migrations/001_initial_schema.sql
   psql -U postgres -d takota_db -f migrations/002_add_sign_status.sql
   ```

6. **Start application:**
   ```bash
   make dev
   ```

### Frontend Configuration

Update Base URL in admin settings:
1. Login to admin dashboard
2. Go to Settings (Pengaturan)
3. Set Base URL to your backend URL (e.g., `http://localhost:8080`)
4. Turn off Mock Mode

---

## Breaking Changes

### v1.1.0
- Frontend folder moved from `takota-frontend/takota-frontend/` to `web/`

---

## Upcoming Features

### Planned for v1.2.0
- [ ] Email notifications for absence approval
- [ ] Attendance statistics charts
- [ ] Monthly attendance summary
- [ ] Export to Excel format
- [ ] QR code check-in
- [ ] Face recognition for attendance
- [ ] Mobile app (React Native)

### Planned for v1.3.0
- [ ] Multi-location support
- [ ] Shift scheduling
- [ ] Leave balance management
- [ ] Overtime tracking
- [ ] Integration with HR systems

---

## Technical Debt & Known Issues

### Current Issues
- [ ] Large date ranges (> 1 month) may timeout on PDF generation
- [ ] No pagination for very large student lists in PDF

### Improvements Needed
- [ ] Add unit tests for PDF generation
- [ ] Add integration tests for export endpoints
- [ ] Implement background job for large PDF generation
- [ ] Add PDF generation progress indicator
- [ ] Cache rendered PDF templates

---

## Contributors

- Backend Development: Go + Gin + GORM
- Frontend Development: React + Vite + HeroUI
- PDF Integration: Client-side PDF generation
- Project Integration: Unified structure & documentation

---

## License

[Specify your license here]

---

For detailed installation instructions, see [INSTALL.md](INSTALL.md).
For project structure details, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
