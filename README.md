# Takota - Attendance and Absence Management System

Takota is a modern attendance and absence management application. Employees can check in with GPS location validation and an optional photo, and submit leave or sick requests with supporting documents. Admins can manage users, review attendance records, approve absences, and export data.

The project is a monorepo with two parts:

- `frontend/`: React application built with Vite, Tailwind CSS, Gravity UI, and Hero UI.
- `backend/`: Go API built with Gin, GORM, PostgreSQL, Redis, and S3 compatible storage.

In production, a single Nginx container serves the built frontend and reverse-proxies `/api/*` requests to the Go backend. A supervisor entrypoint (`docker/entrypoint.sh`) runs both processes together: if the backend or Nginx dies, the other is stopped and the container exits with a non-zero status so the orchestrator restarts the whole thing instead of serving a broken half-started app. A container `HEALTHCHECK` hits `/health` through Nginx, so the image only reports healthy when both Nginx and the API respond.

## Tech Stack

Frontend:

- Framework: React 19
- Build tool: Vite 8
- Routing: React Router 7
- UI libraries: Gravity UI, Hero UI
- Styling: Tailwind CSS 4
- Charts: Recharts
- PDF export: html2pdf.js

Backend:

- Language: Go 1.25
- Web framework: Gin
- Database: PostgreSQL (GORM + pgx)
- Cache: Redis (optional, falls back to PostgreSQL)
- Storage: S3 compatible (MinIO, AWS S3, Supabase Storage)
- Auth: JWT with role-based access control

## Project Structure

```
.
├── frontend/              React frontend (Vite)
│   ├── src/
│   │   ├── components/    Shared UI components
│   │   ├── pages/         User pages (login, attendance, absence, ...)
│   │   ├── admin/         Admin pages and components
│   │   └── lib/           API client and utilities
├── backend/               Go backend
│   ├── cmd/api/           Application entry point
│   ├── internal/          Controllers, middleware, models, utils
│   ├── pkg/               Database, Redis, S3, JWT packages
│   └── migrations/        SQL schema and seed data
├── nginx/default.conf     Nginx config (frontend + /api proxy)
├── Dockerfile             Multi-stage build (frontend + backend)
├── AGENT.md               Contribution rules for humans and AI agents
├── ARCHITECTURE.md        System architecture reference
└── .github/workflows/     CI/CD (PR checks, build, test, publish)
```

## Recent Changes

- **Enriched CSV export** — the admin report export now includes three new columns: **Location** (a Google Maps link built from the stored coordinates), **Photo File** (public URL of the attendance photo), and **Document** (public URL of the absence supporting document, when present). Headers are localized for English and Indonesian.
- **HeroUI Select for report filters** — the Month and Language pickers on the admin reports page now use the HeroUI `Select` component instead of a native `<select>`, matching the rest of the UI.
- **Role-based frontend routing guards** — the `AuthGate` component now enforces roles client-side in addition to the backend middleware: admins who land on user pages (`/main`, `/attendance`, `/absence`, `/photos`) are redirected to `/admin`, and non-admins who open `/admin` are redirected to `/main`.
- **Camera capture & freeze at "Take Attendance!"** — the attendance page now requests camera permission automatically on mount, and pressing "Take Attendance!" captures and freezes the current frame at full sensor resolution. The uploaded photo reflects the exact moment the button was pressed, and canceling the confirmation dialog discards the frame and resumes the live camera.
- **Photo gallery hover info** — hovering a photo in the user gallery now shows a `dd/mm/yyyy hh:mm • by <nickname>` overlay with the timestamp and the user who uploaded it.
- **User home header** — the home page now shows a live clock next to the greeting and a logout button with a confirmation dialog, alongside a shared `BackButton` component and unified headers across the user pages.
- **Admin logout confirmation** — the admin sidebar logout now asks for confirmation before ending the session.
- **Automatic database migrations** — the SQL files in `backend/migrations/` are embedded into the backend binary and applied automatically on every startup. Applied migrations are tracked in the `schema_migrations` table, the backend waits for PostgreSQL to become reachable before migrating, and every migration file is idempotent so existing databases upgrade cleanly.
- **Human-readable attendance location (`display_address`)** — when a user submits attendance, the GPS coordinates are reverse-geocoded through OpenStreetMap Nominatim (a Go port of the former `tmp/get-location.js` sample) and stored in the new `display_address` column. It is shown on the user home and in the admin attendance list.
- **Timezone-aware greetings** — a new `TIMEZONE_APP` variable (falls back to `TIMEZONE`, then to UTC) controls the greeting shown by the API and the PostgreSQL session timezone, so the app greets users correctly (e.g. "Good Morning" at 07:00 WIB) even when deployed in a different timezone.
- **Container supervision & auth gate** — the Docker image runs the backend and Nginx under a supervisor entrypoint, so if either process dies the container exits and the orchestrator restarts it instead of serving a half-running app. `/api/all/info` is now protected by a token check.

## Getting Started with Docker

The multi-stage `Dockerfile` builds the frontend and the backend, then packages both into one Nginx image.

### Prerequisites

- Docker (with Buildx support)

### 1. Build the image

```bash
docker build -t takota:latest .
```

### 2. Run with a database

The backend requires PostgreSQL and S3 compatible storage to start. For local development, spin up PostgreSQL and MinIO first:

```bash
# PostgreSQL
docker run -d --name takota-db \
  -e POSTGRES_USER=takota \
  -e POSTGRES_PASSWORD=takota \
  -e POSTGRES_DB=takota_db \
  -p 5432:5432 \
  postgres:16-alpine

# MinIO (S3 compatible storage)
docker run -d --name takota-minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -p 9000:9000 \
  minio/minio:latest server /data
```

### 3. Run the application

```bash
docker run -d --name takota \
  --restart unless-stopped \
  -p 80:80 \
  -e PORT=8080 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_USER=takota \
  -e DB_PASSWORD=takota \
  -e DB_NAME=takota_db \
  -e DB_SSL_MODE=disable \
  -e S3_ENDPOINT=http://host.docker.internal:9000 \
  -e S3_ACCESS_KEY=minioadmin \
  -e S3_SECRET_KEY=minioadmin \
  -e S3_BUCKET_NAME=takota-bucket \
  -e S3_USE_SSL=false \
  -e S3_USE_PATH_STYLE_ENDPOINT=true \
  -e S3_REGION=us-east-1 \
  -e JWT_SECRET=change-this-secret \
  takota:latest
```

> Linux note: add `--add-host=host.docker.internal:host-gateway` to the run command so the container can reach services on the host machine.

### 4. Apply migrations (automatic)

Migrations run automatically: the backend embeds the SQL files from `backend/migrations/` and applies any that have not been applied yet on every startup (tracked in the `schema_migrations` table). It waits for PostgreSQL to be reachable first, so no manual step is required.

If you prefer to apply them manually (first run only):

```bash
docker run --rm -i \
  -e PGPASSWORD=takota \
  postgres:16-alpine psql -h host.docker.internal -U takota -d takota_db \
  < backend/migrations/001_initial_schema.sql

docker run --rm -i \
  -e PGPASSWORD=takota \
  postgres:16-alpine psql -h host.docker.internal -U takota -d takota_db \
  < backend/migrations/002_add_sign_status.sql

docker run --rm -i \
  -e PGPASSWORD=takota \
  postgres:16-alpine psql -h host.docker.internal -U takota -d takota_db \
  < backend/migrations/003_add_display_address.sql
```

### 5. Access the application

Open `http://localhost`. The frontend is served on port 80 and `/api/*` requests are forwarded to the backend automatically.

## Docker Compose (optional)

For a one-command local setup, create a `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: takota
      POSTGRES_PASSWORD: takota
      POSTGRES_DB: takota_db
    ports:
      - "5432:5432"
    volumes:
      - ./backend/migrations:/docker-entrypoint-initdb.d

  minio:
    image: minio/minio:latest
    command: server /data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"

  app:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
    depends_on:
      - db
      - minio
    environment:
      PORT: 8080
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: takota
      DB_PASSWORD: takota
      DB_NAME: takota_db
      DB_SSL_MODE: disable
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      S3_BUCKET_NAME: takota-bucket
      S3_USE_SSL: "false"
      S3_USE_PATH_STYLE_ENDPOINT: "true"
      S3_REGION: us-east-1
      JWT_SECRET: change-this-secret
      TIMEZONE_APP: Asia/Jakarta
```

Then run:

```bash
docker compose up -d --build
```

The backend applies the embedded SQL migrations automatically once PostgreSQL is reachable, so the schema and seed users are created on first start.

## Configuration

All backend settings are read from environment variables. Copy `backend/.env.example` for reference. Key variables:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Backend port | `8080` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL connection | - |
| `DB_SSL_MODE` | PostgreSQL SSL mode | `disable` |
| `REDIS_URL` | Redis connection (optional) | empty |
| `S3_ENDPOINT` | S3 compatible endpoint | empty (uses AWS) |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | S3 credentials | - |
| `S3_BUCKET_NAME` | Storage bucket | `takota-bucket` |
| `S3_USE_SSL`, `S3_USE_PATH_STYLE_ENDPOINT`, `S3_REGION` | S3 connection settings | - |
| `JWT_SECRET` | Token signing secret | - |
| `JWT_EXPIRY_HOURS` | Token lifetime in hours | `24` |
| `TIMEZONE_APP` | App timezone for greetings/timestamps (falls back to `TIMEZONE`, then UTC) | `UTC` |

## Local Development (without Docker)

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` to `http://localhost:8080`.

Backend:

```bash
cd backend
go run ./cmd/api
```

## Commit Workflow

All changes are developed on pull-request branches and merged into `main` only after review. **Never commit or push directly to `main`** — every commit must land on a PR branch first.

1. Make sure you are not on `main` (use a branch such as `pr/update-fix-setup` or `feature/<topic>`).
2. Commit your changes with a descriptive message (`feat:`, `fix:`, `docs:`, `refactor:`, ...).
3. Run the required checks before pushing (see `AGENT.md`): backend build/vet, frontend build/lint, and a review of `git status`/`git diff` to make sure no secrets or build artifacts are staged.
4. Push to your branch and open a Pull Request against `main`.
5. Merge only after CI passes and the PR has been reviewed.

Commits must never contain secrets (`.env` files, passwords, tokens). See `AGENT.md` for the full set of rules.

## CI/CD

Two GitHub Actions workflows are included:

- `pr-checks.yml`: runs on pull requests to `main`. Builds the frontend, builds the backend, and builds the Docker image.
- `deploy.yml`: runs on pushes to `main`. Builds the image, tests it against PostgreSQL and MinIO, and publishes it to GitHub Container Registry (GHCR).
