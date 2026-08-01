# Takota Backend API

A modern, production-ready attendance and absence management system built with Go, PostgreSQL, Redis, and S3 object storage.

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![Go Version](https://img.shields.io/badge/go-1.25-blue)
![Docker](https://img.shields.io/badge/docker-compose-blue)
![Tests](https://img.shields.io/badge/tests-36%2F36%20passed-green)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🎯 Overview

Takota Backend API is a comprehensive attendance management system designed for enterprise use. It provides:

- **Easy attendance tracking**
- **Absence/leave management** with document uploads
- **Administrative controls** for user and attendance management
- **Real-time data export** to CSV format
- **Secure authentication** with JWT and role-based access control
- **Scalable architecture** with caching and distributed storage

Perfect for companies with remote and office-based employees who need reliable attendance tracking.

---

## ✨ Features

### Core Features

✅ **Authentication System**
- JWT-based authentication with 24-hour token expiry
- Auth ID validation for force logout capability
- Login attempt limiting (5 attempts, 5-minute lockout)
- Secure password hashing with bcrypt

✅ **User Management**
- Self-service dashboard with greeting widget
- Attendance submission with GPS location validation
- Leave/absence request submission with document uploads
- View absence approval status

✅ **Admin Controls**
- Complete user management (CRUD)
- Attendance record viewing and deletion
- Absence approval workflow
- Data export to CSV (English & Indonesian)
- User search and filtering

✅ **Location-Based Features**
- Automatic Google Maps embedding
- Reverse-geocoded `display_address` (OpenStreetMap Nominatim) shown on the user home and admin attendance list
- Location history tracking

✅ **Database Migrations**
- SQL migrations embedded in the binary (`//go:embed`) and applied automatically on startup
- Applied versions tracked in the `schema_migrations` table
- Migrations are idempotent, so existing databases upgrade cleanly

✅ **Timezone-Aware Greetings**
- Configurable via `TIMEZONE_APP` (falls back to `TIMEZONE`, then UTC)
- Greetings and the database session timezone follow the configured timezone

✅ **File Management**
- Photo upload for attendance (max 10MB)
- Document upload for absences (max 50MB)
- Support for PDF, DOC, DOCX formats
- Signed URL generation for secure access
- S3/MinIO compatible storage

✅ **Role-Based Access Control**
- User role: Access to personal attendance
- Admin role: Full system management
- Middleware-level authorization enforcement

---

## 🛠️ Tech Stack

### Programming & Framework
- **Language:** Go 1.25
- **Web Framework:** Gin 1.9.1
- **Validation:** go-playground/validator/v10
- **Authentication:** golang-jwt/jwt/v5

### Database & Caching
- **Database:** PostgreSQL 16 (Alpine)
- **ORM:** GORM with pgx driver
- **Cache:** Redis 7 (Alpine) with PostgreSQL fallback
- **ID Generation:** UUID v6

### Storage & File Management
- **Object Storage:** MinIO/S3 compatible
- **File Client:** minio-go/v7
- **Signed URLs:** Time-limited access with 1-60 min expiry

### Security
- **Password:** bcrypt hashing
- **JWT:** HS256 signing
- **SQL Protection:** Parameterized queries (GORM)
- **Input Validation:** Request-level validation

### Infrastructure
- **Containerization:** Docker (Alpine images)
- **Orchestration:** Docker Compose
- **Networking:** Bridge network with service discovery

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose (recommended)
- Or: Go 1.25, PostgreSQL 16, Redis 7, MinIO

### Using Docker (Recommended)

#### 1. Clone & Setup

```bash
cd src

# Copy environment file
cp .env.example .env

# Optional: Edit .env for custom settings
# Default values are pre-configured for local development
```

#### 2. Start Services

```bash
# Build and start all containers
docker-compose up -d --build

# Wait for services to be healthy (typically 30 seconds)
docker-compose ps

# Verify API is responding
curl http://localhost:8080/health
# Response: {"status":"ok"}
```

#### 3. Access Services

```
API:           http://localhost:8080
MinIO Console: http://localhost:9001
PostgreSQL:    localhost:5432
Redis:         localhost:6379
```

#### 4. Test Login

```bash
curl -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"testing123"}'

# Response: {"token":"<JWT_TOKEN>","login_as":"admin","redirect":"/admin"}
```

#### 5. Stop Services

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (delete all data)
docker-compose down -v
```

### Manual Setup (Without Docker)

#### 1. Install Dependencies

```bash
# macOS
brew install go postgresql redis minio

# Ubuntu/Debian
sudo apt install golang-1.25 postgresql redis-server

# Windows (using chocolatey)
choco install golang postgresql redis
```

#### 2. Setup PostgreSQL

```bash
# Create database and user
createdb takota_db
createuser takota --password

# Run migrations (optional - the app also runs embedded migrations automatically on startup)
psql -U takota -d takota_db -f migrations/001_initial_schema.sql
psql -U takota -d takota_db -f migrations/002_add_sign_status.sql
psql -U takota -d takota_db -f migrations/003_add_display_address.sql
```

#### 3. Setup Redis

```bash
# Start Redis
redis-server

# Or Docker
docker run -d -p 6379:6379 redis:7-alpine
```

#### 4. Setup MinIO

```bash
# Start MinIO
minio server ./data --console-address ":9001"

# Or Docker
docker run -d -p 9000:9000 -p 9001:9001 minio/minio:latest \
  server /data --console-address ":9001"
```

#### 5. Build & Run API

```bash
cd src

# Set environment variables
export DB_HOST=localhost
export REDIS_URL=redis://localhost:6379
export S3_ENDPOINT=localhost:9000
export JWT_SECRET=your-secret-key

# Build
go build -o takota-api ./cmd/api

# Run
./takota-api
```

---

## 🏗️ Architecture

### System Design

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP/HTTPS
       ▼
┌─────────────────────────────────┐
│   Gin Web Framework (Port 8080) │
│  ┌──────────────────────────┐   │
│  │   Middleware Stack       │   │
│  │  - JWT Validation        │   │
│  │  - Role-Based Access     │   │
│  │  - Password Check        │   │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │   Route Handlers         │   │
│  │  - Auth                  │   │
│  │  - User                  │   │
│  │  - Admin                 │   │
│  │  - Global                │   │
│  └──────────────────────────┘   │
└──────────────────────────────────┘
   │          │          │
   ▼          ▼          ▼
┌────────┐ ┌───────┐ ┌─────────┐
│  GORM  │ │ Redis │ │ MinIO/S3│
│   +    │ │       │ │         │
│ pgx    │ │       │ │         │
└─────┬──┘ └───────┘ └─────────┘
      │
      ▼
┌──────────────────┐
│  PostgreSQL 16   │
│  - Users         │
│  - Attendance    │
│  - Absence       │
└──────────────────┘
```

### Data Flow

1. **Authentication:**
   - User login → Generate JWT + Auth ID
   - Auth ID stored in Redis/PostgreSQL
   - Subsequent requests validated via middleware

2. **Attendance:**
   - User submits location + optional photo
   - GPS validation against office radius
   - File uploaded to S3/MinIO
   - Coordinates reverse-geocoded into a display address (OpenStreetMap Nominatim)
   - Record created in PostgreSQL

3. **Absence:**
   - User requests leave with reason + optional document
   - Document uploaded to S3/MinIO
   - Admin approval workflow initiated
   - Status tracked in PostgreSQL

### Database Migrations

Migrations are plain SQL files in `migrations/` (e.g. `001_initial_schema.sql`). They are embedded into the binary with `//go:embed` and applied automatically on startup by `pkg/migrator`:

- A `schema_migrations` table records every applied version.
- Each `*.sql` file runs once, in version order, inside a transaction (a failure rolls back completely).
- Files must be idempotent (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `ON CONFLICT DO NOTHING`, ...) so the runner is safe against databases that were migrated manually.
- New changes go into `00N_<description>.sql`; already-applied migrations are never edited.

### Timezone Handling

The application timezone is read from `TIMEZONE_APP` (falls back to `TIMEZONE`, then UTC). It is used for the greeting widget (`GetGreetingTime`) and is passed to PostgreSQL via the DSN `TimeZone` setting, so the greeting and day boundaries match the users' local time even if the server is deployed elsewhere.

---

## 📡 API Endpoints

### Authentication (Public)

```
POST   /api/auth              Login and get JWT token
POST   /api/auth-chpw         Change password
```

### User Endpoints (Protected - User Role)

```
GET    /api/user/home         Get dashboard with greeting
POST   /api/user/attendance   Submit attendance with location
POST   /api/user/absence      Request absence/leave
```

### Admin Endpoints (Protected - Admin Role)

```
GET    /api/admin/users              List all users
POST   /api/admin/user               Create new user
POST   /api/admin/user/:id           Update user
DELETE /api/admin/user/:id           Delete user

GET    /api/admin/attendances        List all attendances
DELETE /api/admin/attendance         Delete attendance record

GET    /api/admin/absences           List all absence requests
PATCH  /api/admin/absence            Sign/approve absence

GET    /api/admin/export             Export attendance data to CSV
```

### Global Endpoints (Protected - Any Role)

```
GET    /api/all/info          Get logged-in user information
GET    /api/all/photos        Get attendance photo gallery
```

### Utility

```
GET    /health                Health check
```

**For detailed API documentation, see [API_DOCS.md](./docs/API_DOCS.md)**

---

## ⚙️ Configuration

### Environment Variables

All configuration is read from environment variables. A `.env` file is loaded automatically if present (see `.env.example` for the full template). Variables are grouped below by **required** and **optional**, with the code default where one exists.

#### Required - Server

```env
PORT=8080                        # API port (default: 8080)
APP_ENV=development              # Environment: development/production
GIN_MODE=debug                   # Gin logging: debug/release
```

#### Required - Database

```env
DB_HOST=localhost                # PostgreSQL host
DB_PORT=5432                     # PostgreSQL port
DB_USER=takota                   # Database user
DB_PASSWORD=takota_password      # Database password
DB_NAME=takota_db                # Database name
DB_SSL_MODE=disable              # SSL mode: disable/require/verify-ca
```

#### Required - JWT

```env
JWT_SECRET=your-secret-key-change-in-production   # JWT signing secret
```

#### Required - S3/Object Storage

`S3_ACCESS_KEY` and `S3_SECRET_KEY` are always required. `S3_ENDPOINT` and the SSL/path-style flags depend on the provider:

```env
S3_ACCESS_KEY=minioadmin         # Access key (MinIO / AWS / R2)
S3_SECRET_KEY=minioadmin         # Secret key
S3_BUCKET_NAME=takota-bucket     # Storage bucket (default: takota-bucket)
S3_REGION=us-east-1              # Region (default: us-east-1)

# For Local MinIO (Development):
S3_ENDPOINT=http://localhost:9000
S3_USE_SSL=false
S3_USE_PATH_STYLE_ENDPOINT=true

# For AWS S3 (Production): leave S3_ENDPOINT empty (endpoint auto-detected from the bucket)
# S3_ENDPOINT=
# S3_USE_SSL=true
# S3_USE_PATH_STYLE_ENDPOINT=false
# Get credentials from AWS IAM

# For Cloudflare R2 (Cost-effective):
# S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# S3_USE_SSL=true
# S3_USE_PATH_STYLE_ENDPOINT=true
# See docs/S3_SETUP.md for detailed configuration
```

#### Optional - Server

```env
TIMEZONE_APP=Asia/Jakarta        # App timezone for greetings/timestamps
TIMEZONE=Asia/Jakarta            # Fallback timezone when TIMEZONE_APP is unset (final fallback: UTC)
```

#### Optional - Database

```env
DB_MAX_CONNECTIONS=25            # Connection pool size (default: 25)
DB_MAX_IDLE_CONNECTIONS=10       # Max idle connections (default: 10)
DB_SSL_ENABLE=false              # Loaded by config, not yet used by the connection DSN
DB_SSL_CA=                       # Loaded by config, not yet used by the connection DSN
DB_SSL_CERT=                     # Loaded by config, not yet used by the connection DSN
DB_SSL_KEY=                      # Loaded by config, not yet used by the connection DSN
```

#### Optional - Redis

```env
REDIS_URL=redis://localhost:6379   # Leave empty to disable Redis (falls back to PostgreSQL)
REDIS_PASSWORD=                    # Redis password (if required)
REDIS_DB=0                         # Redis database number
```

#### Optional - S3/Object Storage

```env
S3_PUBLIC_HOST=                    # Custom public host for preview URLs (e.g. http://localhost:9001)

# CloudFront signed URLs (requires S3_USE_CLOUDFRONT=true):
S3_USE_CLOUDFRONT=false
CLOUDFRONT_DOMAIN=
CLOUDFRONT_PRIVATE_KEY=
CLOUDFRONT_PUBLIC_KEY_ID=
```

#### Optional - JWT & Application

```env
JWT_EXPIRY_HOURS=24               # Token expiry hours (default: 24)
MAX_LOGIN_ATTEMPTS=5              # Failed login attempts (default: 5)
LOGIN_LOCK_DURATION_MINUTES=5     # Account lock duration (default: 5)
MAX_ATTENDANCE_FILE_SIZE_MB=10    # Photo file size limit (default: 10)
MAX_ABSENCE_FILE_SIZE_MB=50       # Document file size limit (default: 50)
```

### Default Credentials

Seed users are created by the initial migration (password: `testing123` for both):

```
Admin Account:
  Username: admin
  Password: testing123

Regular User:
  Username: user001
  Password: testing123
```

---

## 🧪 Testing

### Manual Testing

```bash
# Health check
curl http://localhost:8080/health

# Login
curl -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"testing123"}'

# Get user info (replace TOKEN with actual token)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8080/api/all/info

# List users (admin only)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8080/api/admin/users
```

### Automated Testing

```bash
# Run comprehensive tests
cd testing
bash test_comprehensive_final.sh

# View test results
cat test_results.json
```

**For detailed testing procedures, see [TESTING.md](./docs/TESTING.md)**

---

## 🚢 Deployment

### Production Deployment

#### Step 1: Setup Infrastructure

```bash
# Create production .env
cp .env.example .env
nano .env  # Edit with production values

# Key production settings:
APP_ENV=production
GIN_MODE=release
JWT_SECRET=generate-strong-random-key
DB_SSL_MODE=require
S3_ENDPOINT=aws.s3.amazonaws.com  # or your S3 provider
REDIS_URL=redis://production-redis-host:6379
TIMEZONE_APP=Asia/Jakarta         # choose the timezone of your users
```

#### Step 2: Build Docker Images

```bash
# Build for production
docker build -t takota-api:v1.0.0 .

# Tag for registry
docker tag takota-api:v1.0.0 your-registry/takota-api:v1.0.0

# Push to registry
docker push your-registry/takota-api:v1.0.0
```

#### Step 3: Deploy to Server

```bash
# Pull latest image
docker pull your-registry/takota-api:v1.0.0

# Start container
docker run -d \
  --name takota-api \
  --env-file .env \
  -p 8080:8080 \
  your-registry/takota-api:v1.0.0
```

#### Step 4: Setup SSL/TLS

```bash
# Use reverse proxy (nginx/traefik) for SSL termination
# Or configure with Let's Encrypt certificates
```

#### Step 5: Configure Backups

```bash
# Setup PostgreSQL backups
# Setup Redis persistence
# Setup S3 lifecycle policies
```

**For detailed deployment guide, see [BUILD.md](./docs/BUILD.md)**

---

## 🔒 Security

### Security Features Implemented

✅ **Authentication**
- JWT with HS256 signing
- 24-hour token expiry
- Auth ID validation for force logout

✅ **Authorization**
- Role-based access control (user/admin)
- Middleware-level enforcement
- Endpoint-specific permissions

✅ **Data Protection**
- Password hashing with bcrypt
- SSL/TLS support for database
- Signed URLs for file access

✅ **Input Validation**
- Request-level validation
- Type checking
- SQL injection protection (GORM)

✅ **Error Handling**
- No sensitive data exposure
- Standardized error messages
- Proper HTTP status codes

### Security Best Practices

1. **Change default credentials** in production
2. **Use strong JWT_SECRET** (minimum 32 characters)
3. **Enable SSL/TLS** for all connections
4. **Setup firewall rules** to restrict access
5. **Enable database backups** with encryption
6. **Monitor logs** for suspicious activity
7. **Regular security updates** for dependencies
8. **Use VPN** for admin access

---

## 📁 Project Structure

```
src/
├── cmd/
│   └── api/
│       └── main.go                    # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go                  # Configuration loader
│   ├── controllers/                   # HTTP request handlers
│   │   ├── auth_controller.go
│   │   ├── user_controller.go
│   │   ├── admin_controller.go
│   │   ├── admin_user_controller.go
│   │   ├── export_controller.go
│   │   └── all_controller.go
│   ├── middlewares/
│   │   └── auth.go                    # Authentication middleware
│   ├── models/
│   │   ├── user.go                    # User model
│   │   └── attendance.go              # Attendance model
│   ├── repository/                    # Database operations
│   ├── services/                      # Business logic
│   └── utils/
│       ├── helpers.go                 # Helper functions
│       └── response.go                # Response formatters
├── pkg/
│   ├── database/
│   │   └── database.go                # PostgreSQL connection
│   ├── redis/
│   │   └── redis.go                   # Redis client
│   ├── s3/
│   │   └── s3.go                      # S3/MinIO handler
│   └── jwt/
│       └── jwt.go                     # JWT utilities
├── migrations/
│   ├── migrations.go                   # Embeds *.sql so migrations run automatically
│   ├── 001_initial_schema.sql          # Database schema + seed users
│   ├── 002_add_sign_status.sql         # sign_status column
│   └── 003_add_display_address.sql     # display_address column (reverse geocoding)
├── testing/                           # Test files
│   ├── test_comprehensive_final.sh
│   ├── test_docker.sh
│   ├── test_final.sh
│   └── test_data.json
├── docs/                              # Documentation
│   ├── API_DOCS.md
│   ├── DB_SCHEMA.md
│   ├── S3_SETUP.md                    # S3/R2/MinIO configuration
│   ├── TECH_FRAMEWORK.md
│   ├── TESTING.md
│   ├── BUILD.md
│   ├── PROJECT_SUMMARY.md
│   ├── TEST_REPORT.md
│   └── DEPLOYMENT_STATUS.md
├── docker-compose.yml                 # Docker orchestration (local dev with MinIO)
├── docker-compose.prod.yml            # Production with AWS S3
├── docker-compose.r2.yml              # Production with Cloudflare R2
├── Dockerfile                         # Docker image definition
├── .env.example                       # Environment template (MinIO)
├── .env.example.aws                   # AWS S3 template
├── .env.example.r2                    # Cloudflare R2 template
├── .gitignore                         # Git ignore rules
├── go.mod                             # Go dependencies
├── go.sum                             # Dependency lock file
└── README.md                          # This file
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Error

**Error:** `failed to connect to database: hostname resolving error`

**Solution:**
```bash
# Check PostgreSQL container
docker-compose ps | grep postgres

# Check network connectivity
docker network ls

# Restart services
docker-compose restart postgres api
```

#### 2. Redis Connection Error

**Error:** `Redis connection refused`

**Solution:**
```bash
# Redis is optional, API will fallback to PostgreSQL
# To fix Redis:
docker-compose restart redis

# Or disable Redis in .env:
REDIS_URL=
```

#### 3. S3/MinIO Connection Error

**Error:** `failed to connect to S3`

**Solution:**
```bash
# Check MinIO status
docker-compose ps | grep minio

# Check S3 credentials in .env
echo $S3_ACCESS_KEY

# Test connection
docker exec takota-api wget -q -O- http://minio:9000/minio/health/live
```

#### 4. API Port Already in Use

**Error:** `Address already in use: 0.0.0.0:8080`

**Solution:**
```bash
# Change port in .env
PORT=8081

# Or kill process using port
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows
```

#### 5. JWT Token Expired

**Error:** `JWT expired, please try login`

**Solution:**
```bash
# Login again to get new token
curl -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"testing123"}'
```

### Getting Logs

```bash
# View API logs
docker-compose logs -f api

# View database logs
docker-compose logs -f postgres

# View Redis logs
docker-compose logs -f redis

# View MinIO logs
docker-compose logs -f minio
```

---

## 📚 Documentation

Comprehensive documentation is available in the `docs/` folder:

- **[API_DOCS.md](./docs/API_DOCS.md)** - Complete API reference
- **[S3_SETUP.md](./docs/S3_SETUP.md)** - S3/MinIO/R2 configuration guide (AWS, Cloudflare R2, MinIO)
- **[DB_SCHEMA.md](./docs/DB_SCHEMA.md)** - Database schema details
- **[TECH_FRAMEWORK.md](./docs/TECH_FRAMEWORK.md)** - Technology stack
- **[TESTING.md](./docs/TESTING.md)** - Testing procedures
- **[BUILD.md](./docs/BUILD.md)** - Build & deployment
- **[PROJECT_SUMMARY.md](./docs/PROJECT_SUMMARY.md)** - Architecture overview
- **[TEST_REPORT.md](./docs/TEST_REPORT.md)** - Test results
- **[DEPLOYMENT_STATUS.md](./docs/DEPLOYMENT_STATUS.md)** - Current status

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- Code follows Go conventions
- Tests pass (`go test ./...`)
- Documentation is updated

---

## 📄 License

This project is proprietary software developed for internal use.

---

## 📞 Support

For issues, questions, or suggestions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review documentation in the `docs/` folder
3. Check API logs: `docker-compose logs api`
4. Contact the development team

---

## 📊 Project Status

✅ **Production Ready**
- 36/36 tests passing (100%)
- All endpoints functional
- Security verified
- Documentation complete

**Last Updated:** 2026-08-01  
**Version:** 1.1.0

---

**Built with ❤️ for reliable attendance management**
