# Troubleshooting: Create User Tidak Berfungsi

## Tanggal: 12 Juli 2026

## 🐛 Masalah

Admin tidak bisa menambahkan user siswa maupun admin baru dari halaman `/admin/users` meskipun sudah mengisi semua data dan klik "Tambah Siswa".

---

## 🔍 Possible Root Causes

### 1. **Mock Mode Aktif** (Most Likely)

**Gejala**:
- Form submit tampak sukses (ada toast "Siswa baru berhasil ditambahkan")
- Tapi setelah refresh, user baru **tidak ada** di tabel
- Data hanya ada di memori browser, tidak tersimpan ke database

**Cara Cek**:
1. Buka halaman `/admin/users`
2. Lihat apakah ada **warning banner kuning** di atas tabel yang bertulisan "⚠️ Mode Mock Aktif"

**Solusi**:
- Klik tombol **"🔧 Matikan Mock Mode & Gunakan Backend Asli"** di warning banner
- Halaman akan reload otomatis
- Mock Mode sekarang OFF, data akan tersimpan ke backend asli

---

### 2. **Validasi Frontend Gagal**

**Gejala**:
- Tidak ada loading indicator saat klik "Tambah Siswa"
- Tidak ada toast error atau success
- Form tidak tertutup

**Kemungkinan Penyebab**:
- Username mengandung karakter khusus (hanya boleh huruf, angka, underscore)
- Password kurang dari 6 karakter
- Nama panggilan atau username kosong

**Cara Cek**:
1. Buka **Browser Console** (F12 → Console tab)
2. Coba submit form
3. Lihat apakah ada error log `Validation failed: ...`

**Solusi**:
- Pastikan username hanya berisi `a-z`, `A-Z`, `0-9`, `_` (underscore)
- Password minimal 6 karakter
- Nama panggilan wajib diisi

---

### 3. **Backend Error (API Failed)**

**Gejala**:
- Form submit, ada loading "Menyimpan..."
- Muncul toast error merah: "Gagal menyimpan data siswa" atau error spesifik dari backend
- Form tetap terbuka

**Cara Cek**:
1. Buka **Browser Console** (F12 → Console tab)
2. Coba submit form
3. Lihat error detail:
   ```
   UserFormModal API error: ApiError: <error message>
   Error details: { message: ..., status: ..., stack: ... }
   ```

**Kemungkinan Error**:

#### a. Username Already Exists
```
Error: Username already exists
```
**Solusi**: Gunakan username lain yang belum ada

#### b. Backend Tidak Jalan
```
Error: Tidak dapat menghubungi server (http://localhost:8080)
```
**Solusi**: 
```bash
# Check apakah backend running
curl http://localhost:8080/health

# Jika tidak ada response, start backend:
cd /mnt/DiskY/takota/takota-full-any/takota
go run cmd/api/main.go
```

#### c. JWT Token Invalid/Expired
```
Error: JWT not valid / JWT expired
```
**Solusi**: Logout dan login kembali sebagai admin

#### d. Permission Denied
```
Error: User is not admin
```
**Solusi**: Login dengan akun admin (bukan user biasa)

---

### 4. **CORS Error**

**Gejala**:
- Error di console: `CORS policy: No 'Access-Control-Allow-Origin'`
- Request ke backend di-block oleh browser

**Solusi**:
- Backend sudah ada CORS middleware, tapi pastikan frontend URL benar
- Check `localStorage.getItem('takota_api_base_url')` di console
- Seharusnya `http://localhost:8080` atau URL backend yang benar

---

## 🔧 Debugging Steps

### Step 1: Check Mock Mode

1. Buka `/admin/users`
2. **Jika ada warning banner kuning** → Mock Mode aktif
3. Klik tombol "Matikan Mock Mode"
4. Halaman reload
5. Warning banner hilang → Mock Mode OFF ✅

### Step 2: Check Console Logs

Saya sudah tambahkan extensive logging di `UserFormModal.jsx`:

```javascript
=== UserFormModal Submit ===
Form data: { nickname, callname, username, password, type, changeAsLogin }
Is Edit: false
Validation passed
Payload to send: { ... }
Mock Mode: false
Calling createUser API...
createUser success: { ... }
```

**Cara Cek**:
1. Buka Console (F12)
2. Submit form
3. Lihat log sequence di atas
4. Jika ada yang **missing** → masalah di step tersebut

### Step 3: Check Backend Logs

Jika frontend OK tapi backend error:

```bash
# View backend logs
tail -f backend.log

# Atau jika run dengan go run:
# Lihat output di terminal tempat backend jalan
```

Cari log untuk request POST `/api/admin/user`

### Step 4: Manual API Test

Test endpoint langsung dengan curl:

```bash
# Login dulu untuk dapat token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

echo "Token: $TOKEN"

# Test create user
curl -X POST http://localhost:8080/api/admin/user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "username": "testuser999",
    "nickname": "Test User",
    "callname": "Test User Full",
    "type": "user",
    "password": "password123",
    "change_as_login": true
  }'
```

**Expected Response**:
```json
{
  "message": "User created successfully",
  "data": {
    "id": "uuid-here"
  }
}
```

**Jika error** → masalah di backend, lihat error message

---

## ✅ Solutions

### Solution 1: Disable Mock Mode (Most Common)

Mock Mode warning banner sekarang punya tombol action:

```jsx
<button onClick={() => {
  api.setMockMode(false)
  window.location.reload()
}}>
  🔧 Matikan Mock Mode & Gunakan Backend Asli
</button>
```

**Before**:
- Data create hanya di memori browser
- Hilang saat refresh

**After**:
- Data tersimpan ke PostgreSQL
- Persist setelah refresh

### Solution 2: Fix Validation Errors

**Username Format**:
```javascript
// ❌ Invalid
"user 001"  // ada spasi
"user@123"  // ada @
"user.name" // ada titik

// ✅ Valid
"user001"
"user_001"
"UserName123"
```

**Password Length**:
```javascript
// ❌ Invalid
"pass"     // < 6 karakter
"12345"    // < 6 karakter

// ✅ Valid
"password123"  // >= 6 karakter
"pass123"      // >= 6 karakter
```

### Solution 3: Check Backend Status

```bash
# Check health
curl http://localhost:8080/health
# Response: {"status":"ok"}

# If backend down, start it:
cd /mnt/DiskY/takota/takota-full-any/takota
go run cmd/api/main.go

# Or with air (hot reload):
air
```

### Solution 4: Re-login

JWT token expired setelah 24 jam:

1. Logout dari admin
2. Login kembali
3. Token baru akan di-generate
4. Try create user again

---

## 🧪 Testing Checklist

### Test Create User - Happy Path

1. ✅ Buka `/admin/users`
2. ✅ Pastikan **tidak ada** warning banner Mock Mode
3. ✅ Klik "Tambah Siswa"
4. ✅ Isi form:
   - Nama Panggilan: `User Test`
   - Nama Lengkap: `User Test Lengkap`
   - Username: `usertest123` (lowercase, no special chars)
   - Password: `password123` (min 6 chars)
   - Tipe Akun: `Siswa`
5. ✅ Klik "Tambah Siswa"
6. ✅ Loading indicator muncul: "Menyimpan..."
7. ✅ Toast success: "Siswa baru berhasil ditambahkan."
8. ✅ Modal tertutup otomatis
9. ✅ User baru **muncul di tabel** (bisa delay 15 detik karena polling)
10. ✅ Refresh browser manual → user tetap ada ✅

### Test Create User - Validation Errors

1. Username dengan spasi: `user 123`
   - **Expected**: Toast error "Username hanya boleh berisi huruf, angka, dan underscore"

2. Password kurang dari 6: `pass`
   - **Expected**: Toast error "Password minimal 6 karakter"

3. Username kosong
   - **Expected**: Toast error "Username wajib diisi"

4. Nama panggilan kosong
   - **Expected**: Toast error "Nama panggilan wajib diisi"

### Test Create User - Duplicate Username

1. Create user: username `duplicate123`
2. Try create lagi dengan username sama
   - **Expected**: Toast error "Username already exists"

---

## 📊 Console Logs Reference

### Success Flow

```
=== UserFormModal Submit ===
Form data: {
  nickname: "Test User",
  callname: "Test User Full",
  username: "testuser123",
  password: "password123",
  type: "user",
  changeAsLogin: true
}
Is Edit: false
Validation passed
Payload to send: {
  nickname: "Test User",
  callname: "Test User Full",
  username: "testuser123",
  password: "password123",
  type: "user",
  changeAsLogin: true
}
Mock Mode: false
Calling createUser API...
createUser success: { message: "User created successfully", data: { id: "..." } }
```

### Validation Error

```
=== UserFormModal Submit ===
Form data: { ... }
Is Edit: false
Validation failed: username format invalid
```

### API Error

```
=== UserFormModal Submit ===
...
Validation passed
Payload to send: { ... }
Mock Mode: false
Calling createUser API...
UserFormModal API error: ApiError: Username already exists
Error details: {
  message: "Username already exists",
  status: 400,
  stack: "..."
}
```

---

## 🔑 Key Files Modified

1. **`web/src/admin/components/UserFormModal.jsx`**
   - Added extensive console logging
   - Improved error handling and display

2. **`web/src/admin/pages/AdminUsers.jsx`**
   - Enhanced Mock Mode warning banner
   - Added button to disable Mock Mode easily

---

## 📞 Still Not Working?

Jika masih tidak bisa setelah follow semua steps:

1. **Screenshot error** dari browser console
2. **Copy full error message** 
3. **Check backend logs**: `tail -f backend.log`
4. **Verify database**: 
   ```sql
   SELECT * FROM users ORDER BY created_at DESC LIMIT 5;
   ```
5. Report dengan detail:
   - Error message lengkap
   - Console logs
   - Backend logs
   - Mock Mode status (ON/OFF)

---

## ✅ Expected Behavior After Fix

✅ Mock Mode OFF (no warning banner)
✅ Form submit dengan validasi yang benar
✅ Loading indicator muncul saat saving
✅ Toast success muncul
✅ Modal tertutup otomatis
✅ User baru **muncul di tabel** dalam 15 detik (auto-refresh)
✅ User **persist setelah refresh browser**
✅ User bisa **login** dengan credentials yang dibuat

**Create user should work perfectly now!** 🎉
