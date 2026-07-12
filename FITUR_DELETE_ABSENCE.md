# Fitur Delete Absence - Dokumentasi

**Tanggal:** 12 Juli 2026  
**Status:** ✅ Selesai dan Teruji

## Ringkasan

Menambahkan fitur delete/hapus pada halaman admin untuk pengajuan izin & sakit dengan validasi ketat bahwa hanya absence yang sudah diverifikasi (disetujui atau ditolak) yang bisa dihapus. Juga memperbaiki masalah tampilan nama siswa di tabel yang sebelumnya hanya menampilkan tanda "-".

---

## Perubahan Backend

### 1. Controller - DeleteAbsence Function
**File:** `internal/controllers/admin_controller.go`

**Fungsi Baru:**
```go
func (ctrl *AdminController) DeleteAbsence(c *gin.Context)
```

**Validasi:**
- ✅ Hanya bisa delete absence records (bukan attendance)
- ✅ Hanya bisa delete jika sudah diverifikasi (sign_status = "allow" atau "reject")
- ✅ Absence yang masih pending tidak bisa dihapus
- ✅ Menghapus file lampiran dari S3/MinIO jika ada
- ✅ Menghapus record dari database

**Error Handling:**
- `400 Bad Request` - ID tidak valid atau absence belum diverifikasi
- `404 Not Found` - Data tidak ditemukan
- `500 Internal Server Error` - Gagal menghapus dari database

### 2. Model Response - AbsenceListItem
**File:** `internal/controllers/admin_controller.go`

**Field Baru:**
```go
type AbsenceListItem struct {
    ID        string        `json:"id"`
    UserID    string        `json:"user_id"`
    Username  string        `json:"username"`  // ✨ Baru
    Nickname  string        `json:"nickname"`  // ✨ Baru
    File      string        `json:"file"`
    Reason    string        `json:"reason"`
    Option    string        `json:"option"`
    Verify    *VerifyDetail `json:"verify"`
    Timestamp string        `json:"timestamp"`
}
```

### 3. Query Optimization - ListAbsences
**File:** `internal/controllers/admin_controller.go`

**Perbaikan:**
- Menambahkan `Preload("User")` untuk eager loading data user
- Mengambil `username` dan `nickname` dari relasi User
- Mengatasi masalah N+1 query

### 4. Routing
**File:** `cmd/api/main.go`

**Route Baru:**
```go
admin.DELETE("/absence/:id", adminCtrl.DeleteAbsence)
```

**Full Path:** `DELETE /api/admin/absence/:id`

---

## Perubahan Frontend

### 1. API Client
**File:** `web/src/admin/lib/api.js`

**Fungsi Baru:**
```javascript
export async function deleteAbsence(id) {
  return request(`/api/admin/absence/${encodeURIComponent(id)}`, { 
    method: 'DELETE' 
  })
}
```

### 2. AdminAbsence Component
**File:** `web/src/admin/pages/AdminAbsence.jsx`

**Perubahan:**

1. **Import Icon Baru:**
   ```jsx
   import { TrashBin } from '@gravity-ui/icons'
   ```

2. **State Management:**
   ```jsx
   const [pendingDelete, setPendingDelete] = useState(null)
   ```

3. **Handler Function:**
   ```jsx
   async function handleConfirmDelete() {
     if (!pendingDelete) return
     setProcessing(true)
     try {
       await api.deleteAbsence(pendingDelete.row.id)
       toast.success('Pengajuan izin berhasil dihapus.')
       setPendingDelete(null)
       handleRefresh()
     } catch (err) {
       toast.error(err.message || 'Gagal menghapus pengajuan.')
     } finally {
       setProcessing(false)
     }
   }
   ```

4. **UI - Tombol Delete:**
   - Hanya muncul untuk absence yang sudah diverifikasi (`sign !== 'pending'`)
   - Icon: TrashBin dengan warna merah (danger)
   - Posisi: Di sebelah tombol "Ubah"

5. **UI - Modal Konfirmasi:**
   ```jsx
   <ConfirmDialog
     open={Boolean(pendingDelete)}
     title="Hapus pengajuan izin ini?"
     description="Pengajuan akan dihapus permanen. Setelah dihapus, 
                  status verifikasi tidak bisa diubah lagi."
     confirmLabel="Hapus"
     danger={true}
     onConfirm={handleConfirmDelete}
   />
   ```

6. **Perbaikan Tampilan Nama:**
   ```jsx
   <p className="font-medium text-neutral-900">
     {row.name || row.raw?.nickname || '—'}
   </p>
   ```

---

## Testing

### Test Case 1: Delete Absence yang Sudah Diverifikasi ✅

**Request:**
```bash
DELETE /api/admin/absence/7c3391e6-e6a0-46fc-ae98-d7750c9eaa33
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Absence deleted successfully"
}
```

**Status:** 200 OK

---

### Test Case 2: Delete Absence yang Pending ❌

**Request:**
```bash
DELETE /api/admin/absence/3764e4f0-bb17-44ed-99ff-fcc33f97e1ba
Authorization: Bearer <token>
```

**Response:**
```json
{
  "error": {
    "status": 400,
    "message": "Cannot delete unverified absence. Please approve or reject first.",
    "code": "ABSENCE_NOT_VERIFIED"
  }
}
```

**Status:** 400 Bad Request

---

### Test Case 3: List Absences dengan Username & Nickname ✅

**Request:**
```bash
GET /api/admin/absences?limit=3
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "f9eecebd-6103-480d-8f63-e61aa1ba641c",
      "user_id": "99c75b20-a86a-415e-b046-f3988ac364d2",
      "username": "farras",
      "nickname": "Ahnaf Farras",
      "file": "",
      "reason": "izinnnnnn",
      "option": "permission",
      "verify": {
        "user_id": "0a2a2e91-2594-4b84-bca5-171fb020a833",
        "username": "sigem",
        "sign_status": "allow"
      },
      "timestamp": "2026-07-12T10:09:31Z"
    }
  ]
}
```

**Status:** 200 OK

---

## UI Flow

### Skenario 1: Absence Pending (Belum Diverifikasi)
```
┌─────────────────────────────────────┐
│ Nama    │ Status   │ Aksi           │
├─────────────────────────────────────┤
│ Farras  │ Pending  │ [✓] [✗]       │  ← Hanya tombol Setujui/Tolak
└─────────────────────────────────────┘
```

### Skenario 2: Absence Sudah Diverifikasi
```
┌─────────────────────────────────────┐
│ Nama    │ Status      │ Aksi         │
├─────────────────────────────────────┤
│ Farras  │ Disetujui   │ [Ubah] [🗑️] │  ← Tombol Ubah + Delete
└─────────────────────────────────────┘
```

### Skenario 3: Klik Tombol Delete
```
┌────────────────────────────────────────┐
│  ⚠️  Hapus pengajuan izin ini?         │
│                                        │
│  Pengajuan dari "Ahnaf Farras" akan   │
│  dihapus permanen. Setelah dihapus,   │
│  status verifikasi tidak bisa diubah  │
│  lagi.                                 │
│                                        │
│         [Batal]        [Hapus] ❌      │
└────────────────────────────────────────┘
```

---

## Keamanan & Validasi

### Backend Validation ✅
1. **Authorization:** Hanya admin yang bisa delete
2. **Status Check:** Hanya absence yang sudah diverifikasi
3. **Type Check:** Hanya record dengan type="absence"
4. **File Cleanup:** Menghapus file dari S3 jika ada
5. **Error Handling:** Pesan error yang jelas

### Frontend Validation ✅
1. **UI Conditional:** Tombol delete hanya muncul jika verified
2. **Confirmation Modal:** User harus konfirmasi sebelum delete
3. **Warning Message:** Peringatan bahwa data akan hilang permanen
4. **Error Handling:** Toast notification untuk error

---

## File yang Dimodifikasi

### Backend
- ✅ `internal/controllers/admin_controller.go` (3 perubahan)
  - Fungsi `DeleteAbsence()` - baru
  - Type `AbsenceListItem` - tambah field username, nickname
  - Fungsi `ListAbsences()` - tambah Preload("User")

- ✅ `cmd/api/main.go` (1 perubahan)
  - Route: `admin.DELETE("/absence/:id", adminCtrl.DeleteAbsence)`

### Frontend
- ✅ `web/src/admin/lib/api.js` (1 perubahan)
  - Fungsi `deleteAbsence(id)`

- ✅ `web/src/admin/pages/AdminAbsence.jsx` (5 perubahan)
  - Import `TrashBin` icon
  - State `pendingDelete`
  - Handler `handleConfirmDelete()`
  - UI tombol delete
  - Modal konfirmasi delete

---

## Build & Deploy

### Rebuild Backend
```bash
cd /mnt/DiskY/takota/takota-full-any/takota
docker-compose build --no-cache api
docker-compose up -d api
```

### Rebuild Frontend (opsional)
```bash
cd /mnt/DiskY/takota/takota-full-any/takota/web
npm run build
```

### Verify
```bash
# Check backend health
curl http://localhost:8080/health

# Check API endpoint
curl -X DELETE http://localhost:8080/api/admin/absence/<id> \
  -H "Authorization: Bearer <token>"
```

---

## Troubleshooting

### Error 404 Page Not Found

**Masalah:** Route tidak terdaftar di backend

**Solusi:**
```bash
# Rebuild backend dengan no-cache
docker-compose build --no-cache api
docker-compose restart api
```

### Nama Siswa Masih Kosong (-)

**Masalah:** Backend belum di-rebuild dengan Preload("User")

**Solusi:**
```bash
# Pastikan backend sudah rebuild dengan kode terbaru
docker-compose build api
docker-compose restart api
```

### Tombol Delete Tidak Muncul

**Masalah:** Frontend belum di-update atau cache browser

**Solusi:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Rebuild frontend: `npm run build`

---

## Kesimpulan

✅ **Backend:** Endpoint DELETE absence sudah berfungsi dengan validasi ketat  
✅ **Frontend:** UI tombol delete + modal konfirmasi sudah ditambahkan  
✅ **Validasi:** Hanya absence yang sudah diverifikasi yang bisa dihapus  
✅ **Fix Nama:** Username dan nickname sudah muncul dengan benar di tabel  
✅ **Testing:** Semua test case passed  

**Status:** Siap untuk production ✨
