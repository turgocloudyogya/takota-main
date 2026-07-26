# 🚀 Production Deployment Guide

Panduan deploy Takota ke production server dengan Nginx sebagai reverse proxy.

---

## 📐 Architecture

```
Internet
   ↓
Nginx (Port 80/443) ← Reverse Proxy
   ├── Rate Limiting
   ├── Security Headers
   ├── SSL Termination
   └── Proxy ALL requests
         ↓
Takota API (Port 8080, internal)
   ├── Serve React Frontend
   ├── Handle API Endpoints
   └── Business Logic
         ↓
PostgreSQL, Redis, Supabase Storage
```

**Nginx Role:** Reverse Proxy (security, rate limiting, SSL)  
**Backend Role:** Application + Web Server (serve API + static files)

---

## 📦 Prerequisites

- Ubuntu 20.04+ / Debian 11+
- CPU: 2+ cores, RAM: 2GB+, Disk: 20GB+
- Docker & Docker Compose installed

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
docker --version
```

---

## 🚀 Deployment Steps

### 1. Download Files (3 Items)

```bash
mkdir ~/takota && cd ~/takota

# Option A: Manual download
# Download docker-compose.yml
wget https://raw.githubusercontent.com/username/takota-app/main/docker-compose.production.yml -O docker-compose.yml

# Download .env template
wget https://raw.githubusercontent.com/username/takota-app/main/.env.example -O .env

# Download nginx config
mkdir -p nginx
wget https://raw.githubusercontent.com/username/takota-app/main/nginx/nginx.conf -O nginx/nginx.conf

# Option B: Git sparse checkout (recommended)
git clone --depth=1 --filter=blob:none --sparse https://github.com/username/takota-app.git temp
cd temp
git sparse-checkout set docker-compose.production.yml .env.example nginx/

# Copy to parent directory
cd ..
cp temp/docker-compose.production.yml docker-compose.yml
cp temp/.env.example .env
cp -r temp/nginx .
rm -rf temp
```

**Files yang dibutuhkan:**
```
~/takota/
├── docker-compose.yml    # Orchestration
├── .env                  # Configuration & secrets
└── nginx/
    └── nginx.conf        # Nginx reverse proxy config
```

### 2. Configure .env

```bash
nano .env
```

**Required values:**

```bash
# =============================================================================
# DOCKER IMAGE (PENTING!)
# =============================================================================
# Format: username/repo-name (tanpa ghcr.io/ prefix)
# Contoh: Jika repo https://github.com/johndoe/takota-app
# Maka isi: johndoe/takota-app
GITHUB_REPOSITORY=username/takota-app
IMAGE_TAG=latest

# =============================================================================
# DATABASE
# =============================================================================
DB_USER=takota_prod
DB_PASSWORD=<generate dengan: openssl rand -base64 32>
DB_NAME=takota_db

# =============================================================================
# JWT SECRET
# =============================================================================
JWT_SECRET=<generate dengan: openssl rand -base64 64>

# =============================================================================
# SUPABASE STORAGE (S3 Compatible)
# =============================================================================
# Ambil dari Supabase Dashboard → Settings → API
S3_ENDPOINT=abc123.supabase.co
S3_PUBLIC_HOST=https://abc123.supabase.co/storage/v1
S3_ACCESS_KEY=<supabase-anon-key>
S3_SECRET_KEY=<supabase-service-role-key>
S3_BUCKET_NAME=takota-bucket
S3_USE_SSL=true
S3_REGION=ap-southeast-1
```

**Generate secrets:**

```bash
# JWT secret (64+ chars)
openssl rand -base64 64

# DB password (32+ chars)
openssl rand -base64 32
```

### 3. Setup Supabase Storage

**Di Supabase Dashboard:**

1. **Storage** → **Create bucket**
   - Name: `takota-bucket`
   - Public: Yes (agar foto attendance bisa diakses)

2. **Settings → API** → Copy credentials:
   - Project URL (untuk `S3_ENDPOINT`)
   - anon/public key (untuk `S3_ACCESS_KEY`)
   - service_role key (untuk `S3_SECRET_KEY`)

### 4. Login to Registry

```bash
# Create GitHub Personal Access Token:
# GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
# Generate new token dengan scope: read:packages

# Login
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 5. Deploy

```bash
cd ~/takota

# Pull images
docker compose pull

# Start services
docker compose up -d

# Check status
docker compose ps
```

**Expected output:**
```
NAME                    STATUS
takota-api-prod         running
takota-nginx-prod       running
takota-postgres-prod    running
takota-redis-prod       running
```

### 6. Verify Deployment

```bash
# Health check via Nginx
curl http://localhost/health
# Expected: {"status":"ok"}

# Test login
curl -X POST http://localhost/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Expected: JWT token

# Access web
curl http://localhost
# Expected: HTML (React app)
```

**Access aplikasi:** `http://your-server-ip`

**Default login:**
- Admin: `admin` / `admin123`
- User: `user001` / `user123`

⚠️ **PENTING: Ganti password default setelah login pertama!**

---

## 🔄 Update Application

Setiap ada update code di GitHub (setelah Actions build image):

```bash
cd ~/takota

# Pull latest image
docker compose pull api

# Restart API only (no downtime untuk database)
docker compose up -d --force-recreate --no-deps api

# Verify
docker compose logs -f api
```

---

## 🔐 SSL/HTTPS Setup

### Option 1: Cloudflare Tunnel (Recommended - Easiest)

Cloudflare Tunnel handles SSL automatically, **tidak perlu edit nginx config**!

```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create takota

# Route domain
cloudflared tunnel route dns takota yourdomain.com

# Run tunnel (test)
cloudflared tunnel run takota

# Setup as service (auto-start)
sudo cloudflared service install
```

**Access:** `https://yourdomain.com` (SSL by Cloudflare!)

### Option 2: Caddy (Auto SSL dengan Let's Encrypt)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configure Caddy
sudo nano /etc/caddy/Caddyfile
```

```caddyfile
yourdomain.com {
    reverse_proxy localhost:80
}
```

```bash
# Restart Caddy
sudo systemctl restart caddy

# Caddy will automatically get SSL cert from Let's Encrypt!
```

**Access:** `https://yourdomain.com` (SSL by Caddy!)

### Option 3: Let's Encrypt Manual (Advanced)

```bash
# Install certbot
sudo apt install certbot

# Stop nginx
docker compose stop nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/

# Update nginx.conf (add HTTPS server block)
nano nginx/nginx.conf

# Restart
docker compose up -d nginx
```

---

## 📊 Monitoring & Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# API only
docker compose logs -f api

# Nginx only
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 api
```

### Container Status

```bash
# Status
docker compose ps

# Resource usage
docker stats

# Health check
curl http://localhost/health
```

### Database Backup

```bash
# Create backup script
cat > ~/backup-takota.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/takota"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker compose exec -T postgres pg_dump -U takota_prod takota_db | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x ~/backup-takota.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup-takota.sh") | crontab -
```

### Restore Backup

```bash
# Stop API
docker compose stop api

# Restore
gunzip -c /backups/takota/db_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose exec -T postgres psql -U takota_prod -d takota_db

# Restart
docker compose start api
```

---

## 🔧 Nginx Configuration

### Edit Nginx Config

```bash
# Edit config
nano nginx/nginx.conf

# Test config syntax
docker compose exec nginx nginx -t

# Reload (no downtime)
docker compose exec nginx nginx -s reload

# Or restart
docker compose restart nginx
```

### Common Nginx Tasks

**Change rate limits:**
```nginx
# Edit nginx/nginx.conf
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;  # Changed from 10 to 20
```

**Add security headers:**
```nginx
# Edit nginx/nginx.conf, in server block
add_header Strict-Transport-Security "max-age=31536000" always;
```

See `nginx/README.md` for more details.

---

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs <service>

# Recreate container
docker compose up -d --force-recreate <service>

# Check config
docker compose config
```

### 502 Bad Gateway (Nginx)

```bash
# Check if API is running
docker compose ps api
docker compose logs api

# Test API directly
curl http://localhost:8080/health

# Check Nginx can reach API
docker compose exec nginx wget -O- http://api:8080/health

# Restart services
docker compose restart api nginx
```

### Database Connection Error

```bash
# Check PostgreSQL
docker compose ps postgres
docker compose logs postgres

# Test connection from API
docker compose exec api wget -O- http://postgres:5432

# Verify credentials in .env
grep DB_ .env
```

### Web Not Accessible

```bash
# Check Nginx
docker compose ps nginx
curl http://localhost/health

# Check if port 80 is open
sudo netstat -tlnp | grep :80

# Check firewall
sudo ufw status
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -a --volumes

# Remove old images
docker image prune -a

# Check logs size
du -sh /var/lib/docker/containers/*/
```

---

## 🔄 Rollback

### To Previous Version

```bash
# Option 1: Use specific tag
nano .env
# Change: IMAGE_TAG=sha-abc1234

docker compose pull api
docker compose up -d --force-recreate --no-deps api

# Option 2: Restore database backup
# See "Restore Backup" section above
```

---

## 📝 Files Summary

### On Server:

```
~/takota/
├── docker-compose.yml       # Orchestration config (150 lines)
├── .env                     # Secrets & configuration
└── nginx/
    ├── nginx.conf           # Nginx reverse proxy config (80 lines)
    ├── README.md            # Nginx documentation (optional)
    └── ssl/                 # SSL certificates (jika manual SSL)
        ├── fullchain.pem
        └── privkey.pem

TOTAL: 3 files + nginx/ folder
```

### In Docker Image:

```
Docker Image contains:
├── takota-api           # Go binary (compiled)
├── web/dist/            # React frontend (built)
└── templates/           # PDF templates

Size: ~50MB (Alpine-based)
```

---

## ✅ Post-Deployment Checklist

- [ ] Change default admin password
- [ ] Change default user password  
- [ ] Setup database backup (crontab)
- [ ] Setup SSL/HTTPS (Cloudflare/Caddy recommended)
- [ ] Configure firewall (allow 80, 443, 22 only)
- [ ] Test file upload (attendance photo)
- [ ] Test Supabase storage connection
- [ ] Verify nginx rate limiting works
- [ ] Setup monitoring/alerts (optional)

---

## 🔒 Security Notes

### DO NOT:
- ❌ Commit .env to git
- ❌ Use default passwords in production
- ❌ Expose database ports publicly
- ❌ Use weak JWT_SECRET (<64 chars)

### DO:
- ✅ Use strong passwords (32+ chars)
- ✅ Setup firewall (only 80, 443, 22)
- ✅ Regular backups
- ✅ Keep Docker images updated
- ✅ Monitor logs
- ✅ Use HTTPS (Cloudflare/Caddy)

---

## 📞 Support

**Issues?**
1. Check logs: `docker compose logs -f`
2. Verify .env: `cat .env | grep -v "^#" | grep -v "^$"`
3. Check health: `curl http://localhost/health`
4. Review troubleshooting section above
5. Check nginx: `docker compose logs nginx`

**Common Issues:**
- 502 Bad Gateway → Check `docker compose logs api`
- Connection refused → Check firewall: `sudo ufw status`
- Image pull error → Check `GITHUB_REPOSITORY` in .env
- SSL not working → Use Cloudflare Tunnel (easiest)

**Need help?** Create issue on GitHub repository.

---

**Last Updated:** 2026-07-27  
**Version:** 1.0.0  
**Architecture:** Nginx reverse proxy + Go backend (serves API + static files)  
**Files:** 3 items (docker-compose.yml + .env + nginx/nginx.conf)
