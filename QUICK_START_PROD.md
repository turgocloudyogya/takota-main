# 🚀 Quick Start - Production Deployment

Panduan deployment Takota ke production server.

---

## 📊 Recommended Strategy: Hybrid

- ✅ Backend Go berjalan native (atau Docker)
- ✅ PostgreSQL, Redis, MinIO di Docker
- ✅ Nginx sebagai reverse proxy
- ✅ Chromium untuk PDF generation

**Kenapa Hybrid?**
- Resource efficient
- Easy to scale
- Flexible configuration
- Best of both worlds

---

## 🎯 Pre-requisites di Server

### Required:
```bash
✅ Ubuntu 20.04+ / Debian 11+ / RHEL 8+
✅ Docker & Docker Compose
✅ Nginx atau Apache
✅ Chrome/Chromium (untuk PDF)
✅ Domain & SSL certificate (recommended)
```

### Check Requirements:
```bash
# Docker
docker --version
docker compose version

# Nginx
nginx -v

# Chromium
chromium --version  # atau chromium-browser --version
```

---

## 📦 Deployment Steps

### 1. Build di Local/CI

**Recommended: Gunakan Make untuk konsistensi ⭐**

```bash
# Di local machine atau CI/CD pipeline

# 1. Verify prerequisites
make check          # Verify Go, Node installed

# 2. Install dependencies
make install        # Install Go modules + npm packages

# 3. Build everything
make build
# ✓ Build backend → bin/takota-api
# ✓ Build frontend → web/dist/
```

**Atau manual step-by-step:**

**A. Build Frontend (React → Static Files)**

```bash
cd web

# Install dependencies
npm install

# Build for production
npm run build

# Output: web/dist/
# Contains: index.html, assets/, dan static files
```

**Frontend dist structure:**
```
web/dist/
├── index.html           # Main HTML
├── assets/
│   ├── index-xxx.js     # Bundled JS (~1MB)
│   ├── index-xxx.css    # Bundled CSS (~445KB)
│   └── fonts/           # Geist Sans fonts
└── ...
```

**B. Build Backend (Go → Binary)**

```bash
cd ..  # back to root

# Build
go build -o bin/takota-api cmd/api/main.go

# Verify
./bin/takota-api --version  # or just run it
```

**Backend binary:**
- Output: `bin/takota-api`
- Size: ~40MB (static linked)
- Portable: Bisa run di server dengan environment yang sama

**Cara kerja integrasi Backend + Frontend:**
1. Backend serve static files dari `web/dist/`
2. Route `/` → `web/dist/index.html`
3. Route `/api/*` → API endpoints
4. Production-ready: Single server, single port

**C. Package untuk Upload**

```bash
# Compress semua yang dibutuhkan
tar -czf takota-production.tar.gz \
  bin/takota-api \
  web/dist/ \
  templates/ \
  migrations/ \
  docker-compose.yml \
  .env.example

# File size: ~50MB
ls -lh takota-production.tar.gz
```

### 2. Upload ke Server

```bash
# Compress files
tar -czf takota-production.tar.gz \
  bin/takota-api \
  web/dist/ \
  templates/ \
  migrations/ \
  docker-compose.yml \
  .env.example

# Upload
scp takota-production.tar.gz user@your-server:/opt/

# SSH ke server
ssh user@your-server

# Extract
cd /opt
tar -xzf takota-production.tar.gz
mv takota-production takota
cd takota
```

### 3. Setup Environment di Server

```bash
# Copy dan edit environment
cp .env.example .env
nano .env

# PENTING: Update ini untuk production!
```

**Production .env settings:**
```bash
# Server
PORT=8080
APP_ENV=production
GIN_MODE=release

# Database (akan di Docker)
DB_HOST=localhost              # atau IP server
DB_PORT=5432
DB_USER=takota
DB_PASSWORD=GANTI_PASSWORD_KUAT   # ⚠️ PENTING
DB_NAME=takota_db
DB_SSL_MODE=require            # Enable SSL

# Redis
REDIS_URL=redis://localhost:6379

# S3/MinIO
S3_ENDPOINT=localhost:9000
S3_PUBLIC_ENDPOINT=your-domain.com:9000  # Public URL
S3_ACCESS_KEY=GANTI_ACCESS_KEY     # ⚠️ PENTING
S3_SECRET_KEY=GANTI_SECRET_KEY     # ⚠️ PENTING
S3_BUCKET_NAME=takota-bucket
S3_USE_SSL=true                    # If using domain

# JWT
JWT_SECRET=GANTI_DENGAN_RANDOM_STRING_PANJANG  # ⚠️ PENTING (min 32 char)
JWT_EXPIRY_HOURS=24

# GPS Validation
ATTENDANCE_RADIUS_ENABLED=true
ATTENDANCE_RADIUS_METERS=100
OFFICE_LATITUDE=-7.7546612         # Koordinat kantor Anda
OFFICE_LONGITUDE=110.3658561
```

### 4. Install Chrome di Server

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y chromium-browser

# RHEL/CentOS
sudo yum install -y chromium

# Verify
chromium --version
```

### 5. Start Docker Services

```bash
# Edit docker-compose.yml (production mode)
nano docker-compose.yml

# Pastikan hanya services ini yang aktif (comment out 'api' service):
# - postgres
# - redis  
# - minio

# Start services
docker compose up -d

# Check status
docker compose ps

# Check logs
docker compose logs -f
```

**Production docker-compose.yml:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: takota-postgres
    environment:
      POSTGRES_USER: takota
      POSTGRES_PASSWORD: ${DB_PASSWORD}  # dari .env
      POSTGRES_DB: takota_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    restart: always

  redis:
    image: redis:7-alpine
    container_name: takota-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: always

  minio:
    image: minio/minio:latest
    container_name: takota-minio
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    restart: always

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 6. Setup Backend Service

**Backend Go API akan:**
- ✅ Serve frontend static files dari `web/dist/`
- ✅ Handle API requests di `/api/*`
- ✅ Generate PDF menggunakan Chromium
- ✅ Connect ke PostgreSQL, Redis, MinIO
- ✅ Listen di port 8080

**Buat systemd service:**
```bash
sudo nano /etc/systemd/system/takota.service
```

**Content:**
```ini
[Unit]
Description=Takota Application (Backend + Frontend)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=takota
WorkingDirectory=/opt/takota
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
EnvironmentFile=/opt/takota/.env
ExecStart=/opt/takota/bin/takota-api
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Enable & start:**
```bash
# Create user (if needed)
sudo useradd -r -s /bin/bash takota
sudo chown -R takota:takota /opt/takota

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable takota
sudo systemctl start takota

# Check status
sudo systemctl status takota

# View logs
sudo journalctl -u takota -f
```

### 7. Setup Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/takota
```

**Content:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API & Backend
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for PDF generation
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend static files
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Access logs
    access_log /var/log/nginx/takota-access.log;
    error_log /var/log/nginx/takota-error.log;
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/takota /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Setup SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto renewal (sudah otomatis, cek dengan:)
sudo certbot renew --dry-run
```

---

## 🔒 Security Checklist

### Required:
- [ ] Change default passwords di `.env`
- [ ] Generate strong JWT_SECRET (min 32 char random)
- [ ] Enable DB SSL (DB_SSL_MODE=require)
- [ ] Setup firewall (ufw/iptables)
- [ ] Enable HTTPS dengan Let's Encrypt
- [ ] Restrict Docker ports (bind to localhost only)
- [ ] Regular backups (database & files)

### Firewall Setup:
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Docker ports should NOT be accessible from outside
# Only Nginx should be public-facing
```

---

## 📊 Monitoring & Maintenance

### Check Service Status:
```bash
# Backend
sudo systemctl status takota
sudo journalctl -u takota -f

# Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/takota-access.log

# Docker services
docker compose ps
docker compose logs -f postgres
```

### Database Backup:
```bash
# Manual backup
docker exec takota-postgres pg_dump -U takota takota_db > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i takota-postgres psql -U takota takota_db < backup_20260712.sql

# Automated backup (cron)
sudo crontab -e
# Add: 0 2 * * * /opt/takota/scripts/backup.sh
```

### Update Application:
```bash
# 1. Build new version locally
npm run build    # frontend
go build ...     # backend

# 2. Upload to server
scp bin/takota-api user@server:/opt/takota/bin/
scp -r web/dist user@server:/opt/takota/web/

# 3. Restart service
sudo systemctl restart takota
```

---

## 🧪 Testing Production

### Health Check:
```bash
curl https://your-domain.com/health
# Expected: {"status":"ok"}
```

### API Test:
```bash
# Login
curl -X POST https://your-domain.com/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get info
curl -H "Authorization: Bearer TOKEN" \
  https://your-domain.com/api/all/info
```

### PDF Generation Test:
- Login as admin
- Go to "Rekap & Unduh"
- Generate PDF
- Should download successfully

---

## 🐛 Troubleshooting Production

### Service won't start:
```bash
sudo journalctl -u takota -n 50
# Check for missing environment variables or permission issues
```

### Database connection error:
```bash
docker logs takota-postgres
# Ensure PostgreSQL is running and accepting connections
```

### PDF generation fails:
```bash
# Check Chromium
which chromium-browser
chromium-browser --version

# Check logs
sudo journalctl -u takota | grep -i "pdf\|chrome"
```

### 502 Bad Gateway:
```bash
# Check if backend is running
sudo systemctl status takota
curl http://localhost:8080/health

# Check Nginx logs
sudo tail -f /var/log/nginx/takota-error.log
```

---

## 📚 Dokumentasi Lengkap

- **[DEPLOYMENT_STRATEGIES.md](DEPLOYMENT_STRATEGIES.md)** - Strategi deployment detail
- **[README.md](README.md)** - Overview & security best practices
- **[INSTALL.md](INSTALL.md)** - Installation guide lengkap

---

## ✅ Production Checklist

- [ ] Server ready (Ubuntu/Debian + Docker)
- [ ] Chromium installed
- [ ] Build frontend (`npm run build`)
- [ ] Build backend (`go build`)
- [ ] Upload files ke server
- [ ] Setup `.env` with production values
- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET
- [ ] Start Docker services (postgres, redis, minio)
- [ ] Setup systemd service for backend
- [ ] Configure Nginx reverse proxy
- [ ] Setup SSL with Let's Encrypt
- [ ] Configure firewall (ufw)
- [ ] Test all features
- [ ] Setup backup cron job
- [ ] Monitor logs
- [ ] Production ready! 🚀

---

**Need Help?** Check [DEPLOYMENT_STRATEGIES.md](DEPLOYMENT_STRATEGIES.md) untuk strategi alternatif.
