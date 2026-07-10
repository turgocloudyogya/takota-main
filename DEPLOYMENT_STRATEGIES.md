# 🚀 Deployment Strategies

Panduan deployment Takota dengan berbagai strategi sesuai kebutuhan.

---

## 📊 Overview: 3 Deployment Options

| Strategy | Complexity | Flexibility | Resources | Best For |
|----------|------------|-------------|-----------|----------|
| **Hybrid** | Medium | High | Moderate | Production (Recommended) |
| **Full Docker** | Low | Medium | High | Containerized environments |
| **Native** | High | Highest | Low | Custom setups |

---

## Strategy 1: Hybrid (Recommended) 🎯

Backend & Frontend native, Services di Docker.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Production Server                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Nginx (Port 80) │         │  Backend Go      │     │
│  │                  │────────►│  (Port 8080)     │     │
│  │  Serve:          │         │                  │     │
│  │  - Frontend      │         │  • takota-api    │     │
│  │    (static)      │         │  • Chrome        │     │
│  └──────────────────┘         └────────┬─────────┘     │
│                                        │                │
│                                        ▼                │
│  ┌────────────────────────────────────────────────┐    │
│  │         Docker Containers                      │    │
│  ├────────────────────────────────────────────────┤    │
│  │                                                │    │
│  │  ┌──────────────┐  ┌──────────────┐          │    │
│  │  │ PostgreSQL   │  │   Redis      │          │    │
│  │  │  :5432       │  │   :6379      │          │    │
│  │  └──────────────┘  └──────────────┘          │    │
│  │                                                │    │
│  │  ┌──────────────┐                             │    │
│  │  │   MinIO      │                             │    │
│  │  │   :9000      │                             │    │
│  │  └──────────────┘                             │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Requirements di Server

```bash
✅ Docker & Docker Compose  # Untuk services
✅ Nginx/Apache             # Web server
✅ Chrome/Chromium          # PDF generation
⚠️  Go (optional)           # Jika compile di server
❌ Node.js                  # Build di local saja
❌ PostgreSQL native        # Pakai Docker
```

### Setup Steps

**1. Persiapan di Local/CI:**
```bash
# Build frontend
cd web
npm install
npm run build  # → web/dist/

# Build backend (optional, bisa di server)
go build -o bin/takota-api cmd/api/main.go
```

**2. Upload ke Server:**
```bash
# Upload semua file
scp -r takota/ user@server:/opt/

# Atau hanya yang diperlukan:
scp bin/takota-api user@server:/opt/takota/
scp -r web/dist user@server:/opt/takota/web/
scp -r templates user@server:/opt/takota/
scp .env user@server:/opt/takota/
scp docker-compose.yml user@server:/opt/takota/
```

**3. Setup di Server:**
```bash
# Install Chrome
sudo apt-get update
sudo apt-get install chromium-browser

# Install Docker (jika belum)
sudo apt-get install docker.io docker-compose

# Start Docker services
cd /opt/takota
docker-compose up -d postgres redis minio

# Run backend
# Option A: Jalankan binary
./bin/takota-api

# Option B: Compile dulu (perlu Go)
go build -o takota-api cmd/api/main.go
./takota-api
```

**4. Setup Nginx:**
```nginx
# /etc/nginx/sites-available/takota
server {
    listen 80;
    server_name your-domain.com;

    # Frontend (static files)
    root /opt/takota/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend health check
    location /health {
        proxy_pass http://localhost:8080/health;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/takota /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**5. Setup Systemd (Backend as Service):**
```ini
# /etc/systemd/system/takota.service
[Unit]
Description=Takota API Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=takota
WorkingDirectory=/opt/takota
Environment=PATH=/usr/local/go/bin:/usr/bin:/bin
ExecStart=/opt/takota/bin/takota-api
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

```bash
# Start service
sudo systemctl daemon-reload
sudo systemctl enable takota
sudo systemctl start takota
sudo systemctl status takota
```

### Pros & Cons

**Pros:**
- ✅ Flexible: Mudah update backend/frontend terpisah
- ✅ Resource efficient: Services di container, app native
- ✅ Easy debugging: Logs langsung accessible
- ✅ Fast compilation: Go compile di server lebih cepat

**Cons:**
- ⚠️ Setup lebih kompleks (Nginx + Systemd)
- ⚠️ Chrome perlu install manual
- ⚠️ Environment variables perlu manage manual

---

## Strategy 2: Full Docker 🐳

Semua di Docker containers.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Production Server                      │
│                  (hanya perlu Docker)                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │        Docker Compose Network                   │   │
│  ├─────────────────────────────────────────────────┤   │
│  │                                                  │   │
│  │  ┌──────────────┐       ┌──────────────┐       │   │
│  │  │   Nginx      │──────►│  Backend Go  │       │   │
│  │  │  Container   │       │  Container   │       │   │
│  │  │  :80         │       │  :8080       │       │   │
│  │  │              │       │              │       │   │
│  │  │  • Frontend  │       │  • Go app    │       │   │
│  │  │    (static)  │       │  • Chrome    │       │   │
│  │  └──────────────┘       └──────┬───────┘       │   │
│  │                                │                │   │
│  │                                ▼                │   │
│  │  ┌──────────────┐  ┌──────────────┐           │   │
│  │  │ PostgreSQL   │  │   Redis      │           │   │
│  │  │  Container   │  │  Container   │           │   │
│  │  │  :5432       │  │  :6379       │           │   │
│  │  └──────────────┘  └──────────────┘           │   │
│  │                                                │   │
│  │  ┌──────────────┐                             │   │
│  │  │   MinIO      │                             │   │
│  │  │  Container   │                             │   │
│  │  │  :9000       │                             │   │
│  │  └──────────────┘                             │   │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Requirements di Server

```bash
✅ Docker & Docker Compose  # ONLY THIS!
❌ Go                       # Di Docker image
❌ Node.js                  # Di Docker image
❌ Chrome/Chromium          # Di Docker image
❌ PostgreSQL native        # Di Docker
❌ Nginx native             # Di Docker
```

### Setup Steps

**1. Update Dockerfile:**
```dockerfile
# Dockerfile
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o takota-api cmd/api/main.go

# Stage 3: Runtime
FROM alpine:latest

# Install Chrome & dependencies
RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    ca-certificates \
    font-liberation \
    nss \
    tzdata

# Create app user
RUN addgroup -g 1000 takota && \
    adduser -D -u 1000 -G takota takota

# Copy binary & files
WORKDIR /app
COPY --from=backend-builder /app/takota-api .
COPY --from=frontend-builder /app/web/dist ./web/dist
COPY templates ./templates
COPY migrations ./migrations

# Set ownership
RUN chown -R takota:takota /app

USER takota

# Environment
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage"

EXPOSE 8080

CMD ["./takota-api"]
```

**2. Update docker-compose.yml:**
```yaml
version: '3.8'

services:
  # PostgreSQL
  postgres:
    image: postgres:16-alpine
    container_name: takota-postgres
    environment:
      POSTGRES_USER: takota
      POSTGRES_PASSWORD: takota_password
      POSTGRES_DB: takota_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - takota-network
    restart: unless-stopped

  # Redis
  redis:
    image: redis:7-alpine
    container_name: takota-redis
    volumes:
      - redis_data:/data
    networks:
      - takota-network
    restart: unless-stopped

  # MinIO
  minio:
    image: minio/minio:latest
    container_name: takota-minio
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    networks:
      - takota-network
    restart: unless-stopped

  # Backend API (NEW!)
  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: takota-api
    ports:
      - "8080:8080"
    environment:
      # Server
      SERVER_PORT: 8080
      GIN_MODE: release
      
      # Database
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: takota
      DB_PASSWORD: takota_password
      DB_NAME: takota_db
      
      # Redis
      REDIS_HOST: redis
      REDIS_PORT: 6379
      
      # S3/MinIO
      S3_ENDPOINT: minio:9000
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      S3_BUCKET_NAME: takota-bucket
      S3_USE_SSL: false
      
      # JWT
      JWT_SECRET: ${JWT_SECRET}
      
    depends_on:
      - postgres
      - redis
      - minio
    networks:
      - takota-network
    restart: unless-stopped

  # Nginx (Optional, untuk serve frontend terpisah)
  nginx:
    image: nginx:alpine
    container_name: takota-nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./web/dist:/usr/share/nginx/html:ro
    depends_on:
      - api
    networks:
      - takota-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  takota-network:
    driver: bridge
```

**3. Deploy:**
```bash
# Clone/Upload project
cd /opt/takota

# Create .env
cat > .env << EOF
JWT_SECRET=your_secret_key_here_minimum_32_characters
EOF

# Build & run
docker-compose up -d --build

# Check logs
docker-compose logs -f api

# Check status
docker-compose ps
```

**4. Migrations:**
```bash
# Run migrations (one-time)
docker-compose exec postgres psql -U takota -d takota_db -f /docker-entrypoint-initdb.d/001_initial_schema.sql
docker-compose exec postgres psql -U takota -d takota_db -f /docker-entrypoint-initdb.d/002_add_sign_status.sql
```

### Pros & Cons

**Pros:**
- ✅ Simplest deployment: `docker-compose up -d`
- ✅ Consistent environment: Dev = Prod
- ✅ Easy scaling: Docker Swarm/Kubernetes ready
- ✅ Isolated: Tidak butuh install apapun di server

**Cons:**
- ⚠️ More resources: Semua di container
- ⚠️ Slower compile: Build di Docker lebih lama
- ⚠️ Harder debugging: Perlu masuk container
- ⚠️ Image size besar: Chrome + Go + Node

---

## Strategy 3: Full Native (Advanced) 💪

Semua native, tidak pakai Docker sama sekali.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Production Server                      │
│             (semua installed natively)                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Nginx (Port 80) │         │  Backend Go      │     │
│  │                  │────────►│  (Port 8080)     │     │
│  │  Serve:          │         │                  │     │
│  │  - Frontend      │         │  • takota-api    │     │
│  │    (static)      │         │  • Chrome        │     │
│  └──────────────────┘         └────────┬─────────┘     │
│                                        │                │
│                                        ▼                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ PostgreSQL   │  │   Redis      │  │   MinIO      │ │
│  │  (native)    │  │  (native)    │  │  (native)    │ │
│  │  :5432       │  │  :6379       │  │  :9000       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Requirements di Server

```bash
✅ Go                       # Compile backend
✅ Nginx/Apache             # Web server
✅ Chrome/Chromium          # PDF generation
✅ PostgreSQL native        # Database
✅ Redis (optional)         # Cache
✅ MinIO atau S3            # File storage
⚠️  Node.js (optional)      # Build frontend di server
❌ Docker                   # Tidak pakai
```

### Setup (Ubuntu/Debian)

```bash
# 1. Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# 2. Install Redis
sudo apt-get install redis-server
sudo systemctl start redis

# 3. Install MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
# Setup MinIO service (see MinIO docs)

# 4. Install Go
wget https://go.dev/dl/go1.25.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.25.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# 5. Install Chrome
sudo apt-get install chromium-browser

# 6. Install Nginx
sudo apt-get install nginx

# 7. Build & Deploy (sama seperti Hybrid Strategy)
```

### Pros & Cons

**Pros:**
- ✅ Maximum performance: Tidak ada overhead container
- ✅ Full control: Customize setiap service
- ✅ Lower resources: Tidak perlu Docker daemon

**Cons:**
- ⚠️ Complex setup: Install & configure semua manual
- ⚠️ Hard to maintain: Update & backup manual
- ⚠️ Environment drift: Dev ≠ Prod

---

## 🎯 Comparison Table

| Aspect | Hybrid | Full Docker | Full Native |
|--------|--------|-------------|-------------|
| **Setup Time** | Medium (30 min) | Fast (10 min) | Slow (2+ hours) |
| **Disk Space** | ~2 GB | ~4 GB | ~1.5 GB |
| **RAM Usage** | ~512 MB | ~1 GB | ~256 MB |
| **CPU Usage** | Low | Medium | Lowest |
| **Maintainability** | Good | Excellent | Hard |
| **Flexibility** | High | Medium | Highest |
| **Scaling** | Manual | Easy | Manual |
| **Best For** | Small-Med prod | Containerized | Custom setup |

---

## 🎓 Which Strategy to Choose?

### Choose **Hybrid** if:
- ✅ Production deployment dengan control tinggi
- ✅ Ada tim DevOps yang familiar dengan Linux
- ✅ Resources server terbatas
- ✅ Perlu update backend/frontend terpisah
- **→ RECOMMENDED untuk most cases**

### Choose **Full Docker** if:
- ✅ Simple deployment: "just run it"
- ✅ Team familiar dengan containers
- ✅ Multi-environment (dev/staging/prod same)
- ✅ Resources server cukup (2+ GB RAM)
- **→ BEST untuk cloud deployments**

### Choose **Full Native** if:
- ✅ Maximum performance needed
- ✅ Custom infrastructure requirements
- ✅ No Docker allowed (security policy)
- ✅ Expert Linux admin available
- **→ ONLY for special cases**

---

## 📚 Next Steps

1. **Pilih strategy** sesuai kebutuhan
2. **Lihat detail setup** untuk strategy yang dipilih
3. **Ikuti [INSTALL.md](INSTALL.md)** untuk step-by-step
4. **Test deployment** di staging environment
5. **Deploy to production** 🚀

---

**Need help? Check [REQUIREMENTS_EXPLAINED.md](REQUIREMENTS_EXPLAINED.md) atau [DOCS_INDEX.md](DOCS_INDEX.md)**
