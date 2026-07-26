# Nginx Configuration

Nginx configuration untuk Takota production deployment.

---

## 📁 Structure

```
nginx/
├── nginx.conf    # Main nginx configuration
└── ssl/          # SSL certificates (optional)
    ├── fullchain.pem
    └── privkey.pem
```

---

## 🎯 Nginx Role

**Reverse Proxy ONLY** - bukan web server untuk static files.

### What Nginx Does:
- ✅ Rate limiting (Auth: 5 req/min, API: 10 req/sec)
- ✅ Security headers (X-Frame-Options, X-XSS-Protection, etc)
- ✅ SSL/TLS termination
- ✅ Access logging
- ✅ Proxy ALL requests ke backend

### What Backend Does:
- ✅ Serve static files (React frontend)
- ✅ Handle API requests
- ✅ Business logic

---

## 🔧 Configuration

### nginx.conf

Current config:
- Listen on port 80
- Proxy all requests to `api:8080`
- Rate limiting for auth and API endpoints
- Security headers
- Gzip compression

### Edit Config:

```bash
nano nginx/nginx.conf

# After editing:
docker compose restart nginx
```

---

## 🔐 SSL Setup

### Option 1: Let's Encrypt (Recommended)

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

# Update nginx.conf to listen on 443 and use SSL

# Restart
docker compose up -d nginx
```

### Option 2: Cloudflare Tunnel (Easiest)

No SSL config needed! Cloudflare handles SSL termination.

---

## 📝 Common Tasks

### View Logs:
```bash
docker compose logs -f nginx
```

### Test Config:
```bash
docker compose exec nginx nginx -t
```

### Reload Config (no downtime):
```bash
docker compose exec nginx nginx -s reload
```

### Restart Nginx:
```bash
docker compose restart nginx
```

---

## 🔧 Customization

### Change Rate Limits:

Edit `nginx.conf`:
```nginx
# Increase API rate limit from 10 to 20 req/sec
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;

# Increase auth from 5 to 10 req/min
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
```

### Add SSL Support:

Edit `nginx.conf`, add server block for HTTPS:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # ... rest of config same as port 80
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

---

## 🐛 Troubleshooting

### Nginx won't start:
```bash
# Check config syntax
docker compose exec nginx nginx -t

# Check logs
docker compose logs nginx
```

### 502 Bad Gateway:
```bash
# Check if API is running
docker compose ps api
curl http://localhost:8080/health

# Check nginx can reach API
docker compose exec nginx wget -O- http://api:8080/health
```

---

**Note:** Nginx config sebagai external file (bukan inline) untuk:
- ✅ Easier editing (syntax highlighting works)
- ✅ Better developer experience
- ✅ Professional standard practice
