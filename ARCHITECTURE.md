# Takota Architecture

## Overview

Takota is a monorepo attendance and absence management application. Employees check in with GPS location validation and an optional photo, submit leave/sick requests with supporting documents, and admins manage users, review records, approve absences, and export data.

Two deployable parts:

- `frontend/` — React 19 single-page application built with Vite, Tailwind CSS, Gravity UI, and Hero UI.
- `backend/` — Go API built with Gin, GORM, PostgreSQL, Redis (optional), and S3-compatible storage.

In production the built frontend and the Go backend run inside a single Nginx image. A supervisor entrypoint runs both processes and exits the container if either one dies, so the orchestrator restarts a healthy app instead of serving a half-started one.

## High-Level Components

```
                        ┌────────────────────────────────────────────┐
                        │                Nginx (:80)                 │
                        │  serves frontend static files              │
                        │  proxies /api/*  ->  backend (:8080)       │
                        └────────────────────────────────────────────┘
                                     │ /api/*
                                     ▼
              ┌──────────────────────────────────────────────────┐
              │             Go API (Gin, port 8080)             │
              │  Middleware: API key → JWT → role → pwd-change  │
              │  Controllers: auth, user, admin, export, all    │
              └───────┬──────────────┬──────────────┬────────────┘
                      │              │              │
                      ▼              ▼              ▼
              ┌───────────┐  ┌───────────┐  ┌───────────────┐
              │ PostgreSQL│  │  Redis    │  │   S3 storage  │
              │  (GORM)   │  │ (optional)│  │ MinIO / AWS / │
              │           │  │           │  │ Cloudflare R2 │
              └───────────┘  └───────────┘  └───────────────┘
```

- **Nginx** serves the built React app from `/usr/share/nginx/html` and reverse-proxies `/api/*` to the backend on `127.0.0.1:8080`. It also sets security headers and allows uploads up to 60 MB.
- **Supervisor** (`docker/entrypoint.sh`) starts the backend and Nginx together and monitors both PIDs, killing the other and exiting non-zero if either dies.

## Backend Architecture

### Layers

```
cmd/api/                Entry point: load config → connect DB → run migrations → routes → serve
internal/config/        Env-based configuration loader (Server, DB, Redis, S3, JWT, App, Upload)
internal/models/        GORM models: User, Attendance
internal/controllers/   HTTP handlers:
                          auth_controller     login + change password
                          user_controller     home, attendance, absence
                          admin_controller    attendance/absence lists + approval
                          admin_user_controller  user CRUD
                          export_controller   CSV export
                          all_controller      /all/info, /all/photos
internal/middlewares/   KeyRequest, Auth (JWT), RequireRole, RequirePasswordChanged
internal/utils/         bcrypt, greetings, response helpers, Google Maps embed, reverse geocoding
pkg/database/           GORM + pgx connection, pool tuning, startup retry
pkg/migrator/           Applies embedded SQL migrations (see below)
pkg/jwt/                JWT sign/verify (HS256)
pkg/redis/              Optional cache for auth sessions; falls back to PostgreSQL
pkg/s3/                 S3-compatible file upload, validation, signed URLs
migrations/             Versioned, idempotent SQL files (embedded at build time)
```

### Startup Sequence

1. Load configuration from environment variables (`config.LoadConfig`).
2. Connect to PostgreSQL, **retrying until it is reachable** (15 attempts × 3 s) so the container can start before the DB is ready.
3. **Run automatic migrations** — `pkg/migrator` creates `schema_migrations`, then applies each pending `migrations/*.sql` file in version order inside a transaction. Migrations are idempotent, so previously-migrated databases upgrade cleanly.
4. Initialize Redis (optional — the app continues if it is down) and the S3 client (required).
5. Start the Gin server with the route table below.

### Request Flow

1. Every request passes `KeyRequestMiddleware` (API key check).
2. Protected groups run `AuthMiddleware` (JWT + auth-id validation) then role enforcement (`RequireRole`) and `RequirePasswordChanged` where needed.
3. The controller loads/validates input, calls `pkg/*` helpers (S3 upload, DB, JWT), and responds with the shared `utils.RespondSuccess`/`utils.RespondError` helpers.

### Route Table

```
Public
  POST   /api/auth                    Login, returns JWT + redirect_home
  GET    /health                      Health check

User (auth + role "user" + password changed)
  GET    /api/user/home               Dashboard: greeting, today attendance, absences
  POST   /api/user/attendance         Submit attendance (location + photo)
  POST   /api/user/absence            Submit absence/leave request

Admin (auth + role "admin" + password changed)
  GET    /api/admin/users             List users
  POST   /api/admin/user              Create user
  POST   /api/admin/user/:user_id     Update user
  DELETE /api/admin/user/:user_id     Delete user
  GET    /api/admin/attendances       List attendances (cursor pagination, search)
  DELETE /api/admin/attendance        Delete attendance
  GET    /api/admin/absences          List absences
  PATCH  /api/admin/absence           Approve/reject absence (sign_status)
  GET    /api/admin/export            Export attendance to CSV

Any authenticated role
  GET    /api/all/info                Current user info + redirect_home (used by the auth gate)
  GET    /api/all/photos              Attendance photo gallery
```

### Attendance Creation Flow

1. Validate `latitude`/`longitude` (required) and optional photo (type + size limits).
2. Upload the photo to S3 if present; get a signed URL for display.
3. Generate the Google Maps embed URL from the coordinates.
4. **Reverse-geocode** the coordinates through OpenStreetMap Nominatim (`utils.ReverseGeocode`) into a human-readable `display_address` (best effort — never blocks submission).
5. Persist the attendance row and return its id.

## Frontend Architecture

```
src/
├── main.jsx               React entry
├── App.jsx                Routes + AuthGate
├── lib/
│   ├── api.js             API client (fetch wrappers)
│   ├── authGate.js        JWT validation via GET /api/all/info
│   ├── location.js        GPS helpers for attendance
│   └── mockData.js        Fallback sample data
├── pages/                 User-facing pages
│   ├── Login.jsx          Login (redirects via backend redirect_home)
│   ├── ChangePassword.jsx
│   ├── Main.jsx           Home: greeting widget, today status, absence list
│   ├── Attendance.jsx     GPS + photo capture
│   ├── Absence.jsx        Leave/sick request form
│   └── Photos.jsx         Attendance photo gallery
├── components/            Shared UI: AbsenceCard, AttendanceSheet, EmptyState, modals...
└── admin/                 Admin app
    ├── AdminLayout.jsx    Shell with navigation
    ├── pages/             Dashboard, Users, Attendance, Absence, Photos, Reports, ApiTester
    ├── components/        FormField, StatCard, StatusChip, Modals, ...
    └── lib/               api.js, normalize.js, session.js, dateWindow.js, download.js
```

### Routing & Auth Gate

`App.jsx` defines the routes. An `AuthGate` component validates the JWT on every route change by calling `GET /api/all/info`:

- Invalid session → `clearSession()` and redirect to `/` (login).
- Valid session on `/` → forwarded to the backend-provided `redirect_home` (`/main` for users, `/dash` for admins).
- `redirect_home` values are enforced server-side by the `RequireRole` middlewares, so an admin hitting `/main` gets pushed to `/dash` by the gate.

### Home (Main.jsx)

- Greeting: prefers the backend's `greeting_widget.time` (computed in the app timezone) and falls back to the device clock.
- Today card: shows `data.today` with the `display_address` label from the API.
- Absence list: maps the last absence records and their `verify.sign_status` (allow/reject/pending).
- Polls `/api/user/home` every 10 seconds.

## Database Schema

PostgreSQL with the `uuid-ossp` extension. All migrations live in `backend/migrations/` and run automatically on startup (see Backend → Startup Sequence).

### users

| Column          | Type        | Notes                                   |
| --------------- | ----------- | --------------------------------------- |
| id              | uuid        | PK, default `uuid_generate_v4()`        |
| username        | varchar(100)| unique, not null                        |
| password        | varchar(255)| bcrypt hash, never serialized           |
| nickname        | varchar(150)| not null                                |
| callname        | varchar(50) | not null (used in greetings)            |
| auth_id         | text        | session auth id for force-logout        |
| type            | varchar(20) | `user` / `admin`, default `user`        |
| change_as_login | boolean     | forces password change on next login    |
| last_login      | timestamptz |                                         |
| created_at / updated_at | timestamptz | maintained by a trigger |

Seed users: `admin` and `user001` (created with `ON CONFLICT (username) DO NOTHING`).

### attendance

| Column          | Type        | Notes                                        |
| --------------- | ----------- | -------------------------------------------- |
| id              | uuid        | PK                                           |
| user_id         | uuid        | FK → users, cascade delete                   |
| type            | varchar(20) | `attendance` or `absence`                    |
| option          | varchar(20) | absence option (e.g. sick/permit)            |
| reason          | text        | absence reason                               |
| photo           | varchar(255)| attendance photo object key                  |
| file            | varchar(255)| absence document object key                  |
| latitude / longitude | varchar(50) | GPS coordinates (attendance)            |
| gmaps_embed     | text        | Google Maps embed URL                        |
| display_address | text        | reverse-geocoded address (attendance)        |
| verify_by       | uuid        | FK → users (admin who approved), set null    |
| sign_status     | varchar(20) | `allow` / `reject` / NULL (pending)          |
| created_at / updated_at | timestamptz | maintained by a trigger            |

### schema_migrations

Created by `pkg/migrator`: `version` (PK) and `applied_at`. Records which SQL files have been applied so migrations run exactly once.

## Key Data Flows

### Authentication

1. `POST /api/auth` validates username/password (bcrypt) and respects the login-attempt lockout.
2. Issues a JWT (HS256, `JWT_EXPIRY_HOURS`) plus an `auth_id`; `auth_id` is stored (Redis if enabled, otherwise PostgreSQL).
3. `AuthMiddleware` verifies the JWT and re-validates the `auth_id` on each request so logout invalidates existing tokens.
4. Users with `change_as_login = true` are forced through `ChangePassword` before accessing app routes.

### Attendance

1. `POST /api/user/attendance` with `latitude`, `longitude`, optional `photo`.
2. Validates, uploads photo to S3, builds Google Maps embed, reverse-geocodes `display_address`.
3. Stores the row; `/api/user/home` surfaces it as `today`.
4. Admins view it in `/api/admin/attendances` with a signed photo URL and `display_address`.

### Absence

1. `POST /api/user/absence` with `reason` + `option` + optional document (rules: cannot submit after same-day attendance; only one pending request).
2. Admin sees it in `/api/admin/absences`; `PATCH /api/admin/absence` sets `verify_by` + `sign_status` (allow/reject).
3. The user home reflects the status in real time.

## Deployment

### Docker Build

The multi-stage `Dockerfile`:

1. Builds the frontend (`npm run build`) → static assets.
2. Builds the backend with `CGO_ENABLED=0` (`go build ./cmd/api`) → static binary, with migrations embedded.
3. Final image: `nginx:1.27-alpine` + `tzdata` (for timezone lookups) + the frontend assets + backend binary + `docker/entrypoint.sh`.

### Runtime

- Port 80 (Nginx) and internal 8080 (backend).
- Requires PostgreSQL and S3 storage; Redis is optional.
- Health check: `HEALTHCHECK` hits `/health` through Nginx, so the container reports healthy only when Nginx and the API both respond.
- Migrations run automatically on startup once PostgreSQL is reachable.

### Environment

All configuration is env-driven (see `backend/.env.example`). Key groups: `PORT`/`APP_ENV`/`GIN_MODE`/`TIMEZONE_APP`, `DB_*`, `REDIS_*`, `S3_*` (+ CloudFront), `JWT_*`, `MAX_LOGIN_ATTEMPTS`, `LOGIN_LOCK_DURATION_MINUTES`, file size limits. Never commit real values — only placeholders in `.env.example`.
