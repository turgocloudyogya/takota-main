# Fix Status "Today" di Halaman /main

**Tanggal:** 12 Juli 2026  
**Status:** ✅ Selesai

---

## 🎯 Masalah

Di halaman `/main`, kolom status **"Today"** menampilkan "Present" bahkan ketika user mengajukan **absence** (izin/sakit), bukan melakukan **attendance** (presensi).

### Perilaku Lama (Salah):
```
User mengajukan izin hari ini
→ Status Today: "Present" ❌ (Salah!)
```

### Perilaku Baru (Benar):
```
User mengajukan izin hari ini
→ Status Today: "No attendance status yet" ✅

User melakukan attendance hari ini
→ Status Today: "Present" ✅
```

---

## 📝 Analisis

### Backend Response Structure (`/api/user/home`)

```json
{
  "data": {
    "greeting_widget": {
      "name": "User",
      "time": "afternoon",
      "title": "Good Afternoon, User 👋"
    },
    "today": {
      "type": "absence",      // 🔍 Key field untuk filtering
      "timestamp": "2026-07-12T12:11:20Z"
    },
    "absence": [...]
  }
}
```

**Field `today.type` bisa bernilai:**
- `"attendance"` → User melakukan presensi (hadir)
- `"absence"` → User mengajukan izin/sakit
- `null` → User belum ada activity hari ini

---

## ✅ Solusi

### File yang Diubah: `web/src/pages/Main.jsx`

**Perubahan di logika mapping data:**

#### ❌ Kode Lama:
```jsx
// Map today's attendance from API
if (data.today) {
  const timestamp = data.today.timestamp
  setTodayStatus({
    date: formatDate(timestamp),
    status: 'present',
    title: `Present on ${formatFullDate(timestamp)}`,
    subtitle: 'Location on Yogyakarta, Sleman',
  })
} else {
  setTodayStatus(null)
}
```

#### ✅ Kode Baru:
```jsx
// Map today's attendance from API
// Only show as "present" if type is "attendance", not "absence"
if (data.today && data.today.type === 'attendance') {
  const timestamp = data.today.timestamp
  setTodayStatus({
    date: formatDate(timestamp),
    status: 'present',
    title: `Present on ${formatFullDate(timestamp)}`,
    subtitle: 'Location on Yogyakarta, Sleman',
  })
} else {
  setTodayStatus(null)
}
```

**Perubahan:**
- ✅ Tambah kondisi: `data.today.type === 'attendance'`
- ✅ Hanya set status "present" jika type adalah "attendance"
- ✅ Jika type adalah "absence" atau null, tampilkan "No attendance status yet"

---

## 🧪 Testing

### Skenario 1: User Melakukan Attendance Hari Ini

**API Response:**
```json
{
  "today": {
    "type": "attendance",
    "timestamp": "2026-07-12T07:30:00Z"
  }
}
```

**UI Result:**
```
┌─────────────────────────────────┐
│ Today                           │
├─────────────────────────────────┤
│ 🟢 12/07                        │
│ Present on 12/07/2026           │
│ Location on Yogyakarta, Sleman  │
└─────────────────────────────────┘
```

---

### Skenario 2: User Mengajukan Absence (Izin/Sakit) Hari Ini

**API Response:**
```json
{
  "today": {
    "type": "absence",
    "timestamp": "2026-07-12T09:15:00Z"
  }
}
```

**UI Result:**
```
┌─────────────────────────────────┐
│ Today                           │
├─────────────────────────────────┤
│                                 │
│   No attendance status yet      │
│                                 │
└─────────────────────────────────┘
```

---

### Skenario 3: User Belum Ada Activity Hari Ini

**API Response:**
```json
{
  "today": null
}
```

**UI Result:**
```
┌─────────────────────────────────┐
│ Today                           │
├─────────────────────────────────┤
│                                 │
│   No attendance status yet      │
│                                 │
└─────────────────────────────────┘
```

---

## 📊 Perbandingan Perilaku

| Kondisi | Type | Sebelum | Sesudah |
|---------|------|---------|---------|
| User attendance | `"attendance"` | ✅ Present | ✅ Present |
| User izin/sakit | `"absence"` | ❌ Present | ✅ No status |
| User belum activity | `null` | ✅ No status | ✅ No status |

---

## 🎨 Visual Flow

### Flow Baru (Benar):
```
User buka /main
    ↓
API call: GET /api/user/home
    ↓
Response data.today
    ↓
┌────────────────────────┐
│ data.today exist?      │
└────────────────────────┘
    ├─ No  → "No attendance status yet"
    └─ Yes → Check type
               ↓
        ┌─────────────────────┐
        │ type === 'attendance'? │
        └─────────────────────┘
            ├─ Yes → Show "Present" 🟢
            └─ No  → "No attendance status yet"
```

---

## 🔍 Debugging

### Cara Cek Response API:

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"user001","password":"user123"}' | jq -r '.token')

# Cek data home
curl -s -X GET "http://localhost:8080/api/user/home" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Key-Request: web" | jq '.data.today'
```

**Output jika user absence:**
```json
{
  "type": "absence",
  "timestamp": "2026-07-12T12:11:20Z"
}
```

**Output jika user attendance:**
```json
{
  "type": "attendance",
  "timestamp": "2026-07-12T07:30:00Z"
}
```

---

## 📁 File yang Dimodifikasi

```
web/src/pages/Main.jsx
```

**1 perubahan:** Tambah kondisi `data.today.type === 'attendance'` pada line 74

---

## ✅ Checklist

- [x] Tambah kondisi type check di Main.jsx
- [x] Test skenario user attendance
- [x] Test skenario user absence
- [x] Test skenario user belum ada activity
- [x] Buat dokumentasi

---

## 🚀 Deploy

Perubahan hanya di **frontend**, tidak perlu rebuild backend.

### Option 1: Development Mode (Hot Reload)
```bash
# Frontend akan auto-reload
cd web
npm run dev
```

### Option 2: Production Build
```bash
cd web
npm run build
```

### Verify
1. Login sebagai user
2. Buka halaman `/main`
3. Jika user sudah attendance hari ini → Status "Present"
4. Jika user sudah izin/sakit hari ini → Status "No attendance status yet"

---

## 💡 Catatan Tambahan

### Mengapa Perubahan Ini Penting?

1. **Akurasi Data:** Status "Present" hanya untuk user yang benar-benar hadir (attendance), bukan mengajukan izin
2. **User Experience:** User tidak bingung melihat status "Present" padahal mereka izin
3. **Business Logic:** Membedakan attendance (hadir) dengan absence (izin/sakit)

### Kemungkinan Improvement Future:

Tampilkan info absence di section "Today" jika type adalah "absence":

```jsx
if (data.today) {
  if (data.today.type === 'attendance') {
    // Show "Present"
  } else if (data.today.type === 'absence') {
    // Show "You submitted absence today" (Future improvement)
  }
}
```

---

## ✅ Kesimpulan

**Status:** Fix sudah diterapkan dan siap digunakan.

**Perubahan:** Minimal (1 line condition check)  
**Impact:** High (memperbaiki logic yang salah)  
**Risk:** Low (tidak mengubah struktur code yang ada)

Frontend sekarang dengan benar hanya menampilkan status "Present" ketika user melakukan **attendance**, bukan **absence**. 🎉
