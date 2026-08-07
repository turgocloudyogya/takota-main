# Takota Backend API

A Go backend for attendance and absence management, built with Gin, GORM, PostgreSQL, Redis (optional), and S3-compatible storage.

## Libraries

- **Web**: Gin 1.9.1 (`github.com/gin-gonic/gin`)
- **ORM**: GORM with pgx driver (`gorm.io/gorm`, `gorm.io/driver/pgx`)
- **Auth**: JWT HS256 (`github.com/golang-jwt/jwt/v5`)
- **Validation**: go-playground/validator/v10
- **Storage**: AWS SDK v2 S3 client (S3-compatible: AWS, MinIO, Cloudflare R2)
- **UUID**: google/uuid (v6)
- **Cache**: go-redis/v9 (optional, falls back to PostgreSQL)
- **Compression**: pgx non-blocking shutdown

## Quick Start

```bash
# Copy env file
cp .env.example .env

# Run with Docker Compose (recommended)
docker-compose up -d --build

# Verify
curl http://localhost:8080/health
# Response: {"status":"ok"}
```

## API Reference

### Authentication

```
POST /api/auth
Content-Type: application/json

Request:
{
  "username": "admin",
  "password": "testing123"
}

Response 200:
{
  "token": "<JWT_TOKEN>",
  "login_as": "admin",
  "redirect": "/admin"
}
```

```
POST /api/auth-chpw
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

Request:
{
  "old_password": "testing123",
  "new_password": "newpassword123"
}

Response 200:
{
  "message": "Password changed successfully"
}
```

### User Endpoints

```
GET /api/user/home
Authorization: Bearer <JWT_TOKEN>

Response 200:
{
  "greeting_widget": {
    "time": "2026-08-03T10:00:00+07:00",
    "greeting": "Good Morning",
    "nickname": "Admin User"
  },
  "today": { ... },
  "absence": [ ... ]
}
```

```
POST /api/user/attendance
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

Fields:
  latitude: "-6.2088" (required)
  longitude: "106.8456" (required)
  photo: <file> (optional, max 10MB)

Response 200:
{
  "message": "Attendance submitted successfully",
  "data": { "id": "..." }
}
```

```
POST /api/user/absence
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

Fields:
  option: "sick" | "permit" | "leave" (required)
  reason: "Feeling unwell" (required)
  file: <file> (optional, max 50MB, PDF/DOC/DOCX)

Response 200:
{
  "message": "Absence request submitted",
  "data": { "id": "..." }
}
```

```
DELETE /api/user/absence/:absence_id
Authorization: Bearer <JWT_TOKEN>

Deletes one of the user's own absence requests. Only works while the
request is still pending (sign_status is null); accepted/rejected
requests return 400 with error code CANNOT_DELETE_VERIFIED_ABSENCE.
Ownership is enforced on the backend, and the uploaded document is also
removed from S3.

Response 200:
{
  "message": "Absence deleted successfully"
}
```

### Admin Endpoints

```
GET /api/admin/users
Authorization: Bearer <JWT_TOKEN>

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "username": "user001",
      "nickname": "User One",
      "callname": "User",
      "type": "user",
      "change_as_login": false,
      "last_login": "2026-08-03T10:00:00Z"
    }
  ]
}
```

```
POST /api/admin/user
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

Request:
{
  "username": "newuser",
  "password": "password123",
  "nickname": "New User",
  "callname": "New",
  "type": "user"
}
```

```
POST /api/admin/user/:user_id
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

Request:
{
  "nickname": "Updated Name",
  "callname": "Updated",
  "change_as_login": true
}
```

```
DELETE /api/admin/user/:user_id
Authorization: Bearer <JWT_TOKEN>
```

```
GET /api/admin/attendances?page=1&search=&month=august&year=2026
Authorization: Bearer <JWT_TOKEN>

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "user": { "nickname": "...", "callname": "..." },
      "type": "attendance",
      "latitude": "-6.2088",
      "longitude": "106.8456",
      "display_address": "Jakarta, Indonesia",
      "photo_url": "https://...",
      "created_at": "2026-08-03T10:00:00Z"
    }
  ],
  "pagination": { "total": 100, "page": 1, "per_page": 20 }
}
```

```
DELETE /api/admin/attendance
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

Request:
{
  "id": "uuid"
}
```

```
GET /api/admin/absences?month=august&year=2026
Authorization: Bearer <JWT_TOKEN>

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "user": { "nickname": "..." },
      "type": "absence",
      "option": "sick",
      "reason": "Feeling unwell",
      "file_url": "https://...",
      "sign_status": null,
      "created_at": "2026-08-03T10:00:00Z"
    }
  ]
}
```

```
PATCH /api/admin/absence
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

Request:
{
  "id": "uuid",
  "sign_status": "allow" | "reject"
}
```

```
GET /api/admin/export?month=august&year=2026&lang=en
Authorization: Bearer <JWT_TOKEN>

Response: CSV or JSON file download

Query params:
  month: English month name (default: current month)
  year: numeric year (default: current year)
  lang: en | id | params | json (default: en)
```

### Global Endpoints

```
GET /api/all/info
Authorization: Bearer <JWT_TOKEN>

Response 200:
{
  "id": "uuid",
  "nickname": "Admin User",
  "name": "Admin",
  "type": "admin",
  "redirect_home": "/admin"
}
```

```
GET /api/all/photos?page=1
Authorization: Bearer <JWT_TOKEN>

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "user": { "nickname": "..." },
      "photo_url": "https://...",
      "created_at": "2026-08-03T10:00:00Z"
    }
  ],
  "pagination": { "total": 50, "page": 1, "per_page": 20 }
}
```

### Health Check

```
GET /health

Response 200:
{
  "status": "ok"
}
```

## Authorization Header

All protected endpoints require:

```
Authorization: Bearer <JWT_TOKEN>
```

The JWT contains:
- `user_id`: user UUID
- `auth_id`: session ID for force-logout validation
- `exp`: expiration timestamp

## Export Format

`GET /api/admin/export` supports multiple output formats:

- `lang=en`: CSV with English headers
- `lang=id`: CSV with Indonesian headers
- `lang=params`: CSV with snake_case headers
- `lang=json`: JSON array with snake_case fields

The JSON export wraps items in:

```json
{
  "time_export": "2026-08-03T10:00:00Z",
  "admin_export": {
    "id": "uuid",
    "nickname": "Admin",
    "name": "Admin User",
    "username": "admin"
  },
  "items": [ ... ]
}
```

## Configuration

All settings via environment variables (see `.env.example`):

```bash
# Server
PORT=8080
APP_ENV=development
GIN_MODE=debug

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=takota
DB_PASSWORD=takota_password
DB_NAME=takota_db
DB_SSL_MODE=disable

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRY_HOURS=24

# S3 (MinIO example)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=takota-bucket
S3_USE_SSL=false
S3_USE_PATH_STYLE_ENDPOINT=true
S3_REGION=us-east-1

# Optional
REDIS_URL=redis://localhost:6379
TIMEZONE_APP=Asia/Jakarta
MAX_LOGIN_ATTEMPTS=10
LOGIN_LOCK_DURATION_MINUTES=5
MAX_ATTENDANCE_FILE_SIZE_MB=10
MAX_ABSENCE_FILE_SIZE_MB=50
```

## Default Credentials

Seed users (password: `testing123`):

```
Admin:  admin / testing123
User:   user001 / testing123
```

## Project Structure

```
cmd/api/              Entry point
internal/
  config/             Env-based configuration
  controllers/        HTTP handlers (auth, user, admin, export, all)
  middlewares/         JWT auth, role enforcement, password change check
  models/             GORM models (User, Attendance)
  utils/              bcrypt, greetings, response helpers, geocoding
pkg/
  database/           PostgreSQL connection + pool tuning
  jwt/                JWT sign/verify
  redis/              Optional cache (falls back to PostgreSQL)
  s3/                 S3 upload, validation, signed URLs
  migrator/           Embedded SQL migration runner
migrations/           Versioned SQL files (applied on startup)
```

## Testing

```bash
# Manual
curl -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"testing123"}'

# Automated
cd testing
bash test_comprehensive_final.sh
```

## License

Proprietary software for internal use.
