# 🐛 Troubleshooting: 404 Error pada Delete Photo

## ❌ Error
```
DELETE /api/admin/photos/:id
Response: 404 page not found
```

## ✅ Solusi yang Sudah Diterapkan

### 1. **Backend Routing** (cmd/api/main.go)
Endpoint sudah ditambahkan di admin group:

```go
admin := api.Group("/admin")
admin.Use(middlewares.AuthMiddleware(db))
admin.Use(middlewares.RequireRole("admin"))
admin.Use(middlewares.RequirePasswordChanged())
{
    // ... routes lainnya ...
    
    // Photos management (use request body like attendance)
    admin.DELETE("/photo", allCtrl.DeletePhoto)
    
    // ... routes lainnya ...
}
```

**Endpoint:** `DELETE /api/admin/photo`  
**Request Body:** `{"id": "photo-uuid-here"}`

### 2. **Frontend API** (web/src/admin/lib/api.js)
Fungsi sudah update untuk mengirim ID via request body:

```javascript
export async function deletePhoto(id) {
  return request('/api/admin/photo', { method: 'DELETE', body: { id } })
}
```

### 3. **Controller** (internal/controllers/all_controller.go)
Controller DeletePhoto menggunakan request body (konsisten dengan DeleteAttendance):

```go
var req struct {
    ID string `json:"id" binding:"required"`
}
```

---

## 🔧 Cara Memperbaiki Error 404

### Step 1: Restart Backend (PENTING!)

Backend **HARUS** di-restart agar perubahan routing berlaku:

```bash
# Stop backend yang sedang running (Ctrl+C)
# Lalu restart:

# Opsi A: Via Make
make backend

# Opsi B: Manual
go run cmd/api/main.go

# Opsi C: Docker
docker-compose restart api
```

### Step 2: Restart Frontend (Opsional)

Jika frontend masih cache code lama:

```bash
# Stop frontend (Ctrl+C)
# Lalu restart:

cd web
npm run dev

# Atau via Make
make frontend
```

### Step 3: Hard Refresh Browser

Clear browser cache:
- **Chrome/Edge**: `Ctrl + Shift + R` (Windows/Linux) atau `Cmd + Shift + R` (Mac)
- **Firefox**: `Ctrl + F5` (Windows/Linux) atau `Cmd + Shift + R` (Mac)

---

## 🧪 Testing Manual

### Test 1: Cek Backend Running

```bash
curl http://localhost:8080/health

# Expected: {"status":"ok"}
```

### Test 2: Login & Get Token

```bash
curl -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Expected: {"token":"eyJ..."}
```

### Test 3: List Photos (Get Photo ID)

```bash
# Ganti YOUR_TOKEN dengan token dari step 2
curl -X GET "http://localhost:8080/api/all/photos?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: {"data":[{"id":"uuid-here",...}],"last_id":"..."}
# Copy salah satu photo ID
```

### Test 4: Delete Photo

```bash
# Ganti YOUR_TOKEN dan PHOTO_ID
curl -X DELETE http://localhost:8080/api/admin/photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"PHOTO_ID"}' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: 
# {"message":"Photo deleted successfully"}
# HTTP Status: 200
```

**Atau gunakan test script:**

```bash
./test-delete-photo.sh
```

---

## 🔍 Debug HTTP Status Codes

| Status | Arti | Solusi |
|--------|------|--------|
| **200** | ✅ Berhasil | Foto terhapus |
| **404** | ❌ Not Found | Backend belum restart / routing belum update |
| **401** | ❌ Unauthorized | Token expired atau invalid, login ulang |
| **403** | ❌ Forbidden | Bukan admin atau password belum diubah |
| **500** | ❌ Server Error | Cek logs backend |

---

## 📋 Checklist Debugging

Jika masih 404, cek satu per satu:

### Backend
- [ ] File `cmd/api/main.go` sudah ada route `admin.DELETE("/photos/:id", ...)`
- [ ] Backend sudah di-**restart** setelah perubahan
- [ ] Backend running di port 8080: `curl localhost:8080/health`
- [ ] Tidak ada error di logs backend

### Frontend
- [ ] File `web/src/admin/lib/api.js` punya fungsi `deletePhoto`
- [ ] Path endpoint: `/api/admin/photos/${id}` (bukan `/api/all/photos`)
- [ ] Frontend sudah di-restart (opsional)
- [ ] Browser cache sudah di-clear (Ctrl+Shift+R)

### Network
- [ ] Buka DevTools > Network tab
- [ ] Klik trash icon pada foto
- [ ] Lihat request yang dikirim:
  - URL: `http://localhost:8080/api/admin/photos/[uuid]`
  - Method: `DELETE`
  - Headers: `Authorization: Bearer ...`
  - Status: Harusnya 200, bukan 404

---

## 🎯 Root Cause Analysis

### Kemungkinan 1: Backend Belum Di-Restart ✅ **MOST COMMON**

**Problem:** Perubahan routing di `main.go` tidak akan berlaku sampai backend di-restart.

**Solution:**
```bash
# Stop backend (Ctrl+C di terminal)
# Start lagi:
make backend
# atau
go run cmd/api/main.go
```

### Kemungkinan 2: Salah Endpoint

**Problem:** Frontend masih pakai endpoint lama `/api/all/photos/:id`

**Check:** Buka `web/src/admin/lib/api.js`, pastikan:
```javascript
export async function deletePhoto(id) {
  return request(`/api/admin/photos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  //              ^^^^^^^^^^^^ harus /api/admin/photos, bukan /api/all/photos
}
```

### Kemungkinan 3: Routing Conflict

**Problem:** Ada middleware yang memblock request.

**Check:** Lihat middleware chain di `main.go`:
```go
admin.DELETE("/photos/:id", allCtrl.DeletePhoto)
```

Admin group sudah punya middleware:
- `AuthMiddleware` - Cek token ✅
- `RequireRole("admin")` - Cek role admin ✅
- `RequirePasswordChanged()` - Cek password sudah diubah ✅

Pastikan akun admin sudah ganti password default!

---

## 💡 Quick Fix Command

Restart semua:

```bash
# Terminal 1: Restart backend
cd /path/to/takota-app
make backend

# Terminal 2: Restart frontend
make frontend

# Browser: Hard refresh (Ctrl+Shift+R)
```

---

## 📞 Masih Error?

Jalankan perintah ini dan share outputnya:

```bash
# 1. Cek routing backend
cd /path/to/takota-app
grep -A 5 "admin.DELETE" cmd/api/main.go

# 2. Cek fungsi frontend
grep -A 2 "deletePhoto" web/src/admin/lib/api.js

# 3. Test endpoint
./test-delete-photo.sh

# 4. Lihat logs backend
# (output dari terminal backend)
```

---

## ✅ Verifikasi Final

Setelah restart backend & frontend:

1. Login sebagai admin
2. Buka Galeri Foto
3. Klik trash icon
4. Konfirmasi delete
5. ✅ Foto terhapus, muncul toast "Foto berhasil dihapus"

**Jika berhasil, selamat! 🎉**

**Jika masih error, lakukan debugging step-by-step di atas.**
