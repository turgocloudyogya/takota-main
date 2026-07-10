# 📋 Requirements - Host Server

Software yang perlu diinstall di host server untuk menjalankan Takota.

> **Note:** PostgreSQL, Redis, dan MinIO sudah di-handle oleh Docker Compose. File ini hanya menjelaskan yang perlu install di host server.

---

## 1. Docker & Docker Compose

**Fungsi:**
- Menjalankan PostgreSQL (database)
- Menjalankan Redis (cache)
- Menjalankan MinIO (file storage)

**Instalasi Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# Enable & start
sudo systemctl enable docker
sudo systemctl start docker

# Verify
docker --version
docker-compose --version
```

**Instalasi CentOS/RHEL:**
```bash
sudo dnf install -y docker docker-compose
sudo systemctl enable docker
sudo systemctl start docker
```

---

## 2. Go 1.25+

**Fungsi:**
- Compile backend source code menjadi binary executable
- Diperlukan jika ingin compile di server
- Tidak perlu jika upload binary yang sudah di-compile

**Instalasi:**
```bash
# Download
wget https://go.dev/dl/go1.25.linux-amd64.tar.gz

# Extract
sudo tar -C /usr/local -xzf go1.25.linux-amd64.tar.gz

# Add to PATH
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Verify
go version
```

**Alternative:** Upload binary yang sudah di-compile (tidak perlu install Go)
```bash
# Di local:
GOOS=linux GOARCH=amd64 go build -o takota-api cmd/api/main.go

# Upload ke server:
scp takota-api user@server:/opt/takota/

# Di server (tanpa Go):
./takota-api
```

---

## 3. Chrome/Chromium

**Fungsi:**
- Generate PDF dari template HTML
- Di-spawn otomatis oleh backend saat user export PDF
- Tidak berjalan sebagai background service

**Instalasi Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y chromium-browser

# Verify
which chromium-browser
chromium-browser --version
```

**Instalasi CentOS/RHEL:**
```bash
sudo dnf install -y chromium

# Verify
which chromium
```

**Instalasi Alpine:**
```bash
sudo apk add chromium

# Verify
which chromium-browser
```

**Troubleshooting:**

Jika error "chrome failed to start":
```bash
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libappindicator3-1
```

Jika font rendering issues:
```bash
sudo apt-get install -y \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    fonts-liberation
```

---

## 4. Nginx (Web Server)

**Fungsi:**
- Serve frontend static files (web/dist/)
- Reverse proxy ke backend API

**Instalasi:**
```bash
sudo apt-get install -y nginx

# Enable & start
sudo systemctl enable nginx
sudo systemctl start nginx

# Verify
nginx -v
sudo systemctl status nginx
```

**Konfigurasi:**
```nginx
# /etc/nginx/sites-available/takota
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    root /opt/takota/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/takota /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📝 Quick Install Script

```bash
#!/bin/bash
# install-requirements.sh

# 1. Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# 2. Go (optional, jika compile di server)
wget https://go.dev/dl/go1.25.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.25.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc

# 3. Chrome
sudo apt-get install -y chromium-browser

# 4. Nginx
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Verify
echo "=== Verification ==="
docker --version
go version
chromium-browser --version
nginx -v

echo "✅ All requirements installed!"
```

---

## ✅ Verification

```bash
# Check Docker
docker --version
docker-compose ps

# Check Go (if installed)
go version

# Check Chrome
which chromium-browser
chromium-browser --version

# Check Nginx
nginx -v
sudo systemctl status nginx

# Check ports
sudo netstat -tulpn | grep -E '80|8080|5432|6379|9000'
```

---

**Services di Docker (tidak perlu install):**
- ✅ PostgreSQL (database)
- ✅ Redis (cache)
- ✅ MinIO (file storage)

**Install di Host Server:**
- ✅ Docker & Docker Compose
- ✅ Go 1.25+ (atau upload binary)
- ✅ Chrome/Chromium
- ✅ Nginx

---

**Lihat juga:**
- [INSTALL.md](INSTALL.md) - Installation guide lengkap
- [DEPLOYMENT_STRATEGIES.md](DEPLOYMENT_STRATEGIES.md) - Deployment options
