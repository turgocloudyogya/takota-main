# 🔥 WAJIB DIBACA - Cara Restart Backend dengan Benar

## ⚠️ MASALAH: Error 404 Page Not Found

Jika Anda mendapat error **404 page not found** saat delete photo dari admin/photos, itu artinya **BACKEND BELUM DI-RESTART** setelah perubahan code.

---

## ✅ SOLUSI: Restart Backend (Step by Step)

### Step 1: Stop Backend yang Sedang Running

Cari terminal tempat backend running, lalu:

```bash
# Tekan Ctrl+C untuk stop backend
# Atau jika tidak tahu terminal mana, kill process:

# Linux/Mac:
pkill -f "go run"
pkill -f "takota-api"

# Atau manual:
ps aux | grep "go run"
# Lihat PID, lalu:
kill -9 <PID>
```

**Verifikasi backend sudah mati:**
```bash
curl http://localhost:8080/health
# Harusnya: curl: (7) Failed to connect to localhost port 8080
```

### Step 2: Start Backend dengan Perubahan Baru

**Pilih SALAH SATU cara:**

#### Opsi A: Via Make (Recommended)
```bash
cd /path/to/takota-app
make backend
```

#### Opsi B: Manual via go run
```bash
cd /path/to/takota-app
go run cmd/api/main.go
```

#### Opsi C: Build binary lalu run
```bash
cd /path/to/takota-app
go build -o takota-api cmd/api/main.go
./takota-api
```

#### Opsi D: Docker (jika pakai docker)
```bash
docker-compose restart api
# atau
docker-compose down
docker-compose up -d --build
```

### Step 3: Verifikasi Backend Running

**Test health check:**
```bash
curl http://localhost:8080/health
# Expected: {"status":"ok"}
```

**Test endpoint delete photo:**
```bash
# Jalankan script test
./test-quick-delete-photo.sh

# Expected output:
# ✅ Backend running
# ✅ Login berhasil
# ⚠️  404 Not Found: Data tidak ditemukan (normal untuk dummy ID)
# atau
# ⚠️  400 Bad Request: Format request salah (normal)
```

**JIKA MASIH 404 dengan pesan "page not found":**
```
❌ ROUTING ISSUE: Endpoint tidak terdaftar di backend!
```

Artinya backend belum benar-benar restart dengan perubahan code baru.

---

## 🔍 Debug Checklist

Jika masih 404, cek satu per satu:

### ✅ Backend Code
```bash
# 1. Cek routing ada
grep -n 'admin.DELETE("/photo"' cmd/api/main.go

# Expected output:
# 145:			admin.DELETE("/photo", allCtrl.DeletePhoto)

# 2. Cek controller ada
grep -n 'func.*DeletePhoto' internal/controllers/all_controller.go

# Expected output:
# 193:func (ctrl *AllController) DeletePhoto(c *gin.Context) {
```

### ✅ Backend Compile
```bash
# Test compile
go build -o /tmp/test-build cmd/api/main.go

# Expected: No error
```

### ✅ Backend Process
```bash
# Cek backend running
ps aux | grep -E "go run|takota-api" | grep -v grep

# Expected: Ada 1 atau lebih proses
```

### ✅ Backend Listening
```bash
# Cek port 8080 listening
lsof -i :8080
# atau
netstat -an | grep 8080

# Expected: Ada process yang listen di port 8080
```

### ✅ Endpoint Test
```bash
# Test endpoint dengan dummy request
curl -X DELETE http://localhost:8080/api/admin/photo \
  -H "Content-Type: application/json" \
  -d '{"id":"test"}' \
  -w "\nHTTP: %{http_code}\n"

# Expected status code: 
# - 401 (jika belum login) ✅ BERARTI ROUTING ADA
# - 400 (bad request) ✅ BERARTI ROUTING ADA
# - 404 dengan "page not found" ❌ ROUTING TIDAK ADA
```

---

## 🎯 Quick Test Commands

Copy-paste ini di terminal:

```bash
# 1. Kill backend lama
pkill -f "go run" 2>/dev/null
sleep 2

# 2. Start backend baru di background
cd /path/to/takota-app
nohup go run cmd/api/main.go > backend.log 2>&1 &

# 3. Wait backend ready
sleep 3

# 4. Test health
curl http://localhost:8080/health

# 5. Test delete endpoint (tanpa auth)
curl -X DELETE http://localhost:8080/api/admin/photo \
  -H "Content-Type: application/json" \
  -d '{"id":"test"}' \
  -w "\nHTTP: %{http_code}\n"

# 6. Lihat logs
tail -f backend.log
```

---

## 📱 Test via Browser (After Restart)

1. **Hard refresh browser** (penting!):
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5` / `Cmd+Shift+R`

2. **Open DevTools** (`F12`):
   - Go to **Network** tab
   - Keep it open

3. **Login** sebagai admin

4. **Buka Galeri Foto**

5. **Klik trash icon** pada foto

6. **Lihat Network tab**:
   - URL: `http://localhost:8080/api/admin/photo`
   - Method: `DELETE`
   - Request Payload: `{"id":"uuid-here"}`
   - Status:
     - **200 OK** ✅ Berhasil!
     - **404 Not Found** ❌ Backend belum restart
     - **401 Unauthorized** ⚠️ Token expired, login ulang
     - **400 Bad Request** ⚠️ Cek console error

---

## 🆘 Masih Gagal?

Jalankan perintah ini dan share outputnya:

```bash
# 1. Cek routing di code
echo "=== ROUTING CHECK ==="
grep -A 5 'admin.DELETE("/photo"' cmd/api/main.go

# 2. Cek backend process
echo "=== PROCESS CHECK ==="
ps aux | grep -E "go run|takota-api" | grep -v grep

# 3. Cek port
echo "=== PORT CHECK ==="
lsof -i :8080 || netstat -an | grep 8080

# 4. Test endpoint
echo "=== ENDPOINT TEST ==="
curl -X DELETE http://localhost:8080/api/admin/photo \
  -H "Content-Type: application/json" \
  -d '{"id":"test"}' \
  -w "\nHTTP: %{http_code}\n"

# 5. Test health
echo "=== HEALTH CHECK ==="
curl http://localhost:8080/health
```

---

## 💡 Common Mistakes

1. ❌ **Edit code tapi lupa restart** → Backend masih pakai code lama
2. ❌ **Restart terminal tapi backend masih running di background** → Backend lama masih jalan
3. ❌ **Multiple backend instance** → Port conflict atau request ke backend lama
4. ❌ **Browser cache** → Frontend masih pakai JS lama
5. ❌ **Salah terminal** → Restart di terminal yang salah

---

## ✅ Summary Checklist

Sebelum test lagi, pastikan:

- [ ] Backend code sudah ada `admin.DELETE("/photo", allCtrl.DeletePhoto)`
- [ ] Backend sudah di-**restart** (kill lalu start lagi)
- [ ] Backend running: `curl localhost:8080/health` return `{"status":"ok"}`
- [ ] Endpoint registered: Test dengan `./test-quick-delete-photo.sh`
- [ ] Browser sudah di-hard refresh (`Ctrl+Shift+R`)
- [ ] Login ulang sebagai admin (token mungkin expired)

---

**Jika semua checklist ✅ tapi masih 404, ada kemungkinan:**
- Frontend masih cache code lama → Restart frontend juga
- Multiple backend running → Kill semua, start 1 saja
- Port 8080 dipakai aplikasi lain → Ganti port di .env

**Need help? Run:**
```bash
./test-quick-delete-photo.sh
```
