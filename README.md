# Takota - Attendance and Absence Management System

Takota is a modern attendance and absence management application. Employees can check in with GPS location validation and an optional photo, and submit leave or sick requests with supporting documents. Admins can manage users, review attendance records, approve absences, and export data.

The project is a monorepo with two parts:

- `frontend/`: React application built with Vite, Tailwind CSS, Gravity UI, and Hero UI.
- `backend/`: Go API built with Gin, GORM, PostgreSQL, Redis, and S3 compatible storage.

In production, a single Nginx container serves the built frontend and reverse-proxies `/api/*` requests to the Go backend.

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
└── .github/workflows/     CI/CD (PR checks, build, test, publish)
```

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

### 4. Apply migrations (first run only)

The schema is created automatically by GORM on startup. For the default admin and user accounts, apply the migration files once:

```bash
docker run --rm -i \
  -e PGPASSWORD=takota \
  postgres:16-alpine psql -h host.docker.internal -U takota -d takota_db \
  < backend/migrations/001_initial_schema.sql

docker run --rm -i \
  -e PGPASSWORD=takota \
  postgres:16-alpine psql -h host.docker.internal -U takota -d takota_db \
  < backend/migrations/002_add_sign_status.sql
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
```

Then run:

```bash
docker compose up -d --build
```

The migration files are mounted into the database container, so the schema and seed users are applied automatically on first start.

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

## CI/CD

Two GitHub Actions workflows are included:

- `pr-checks.yml`: runs on pull requests to `main`. Builds the frontend, builds the backend, and builds the Docker image.
- `deploy.yml`: runs on pushes to `main`. Builds the image, tests it against PostgreSQL and MinIO, and publishes it to GitHub Container Registry (GHCR).
