# Fix: Error 404 pada Fitur Unduh PDF

## Masalah
Saat mengklik tombol "Buat & Unduh PDF" di halaman Rekap & Unduh, muncul error 404 (page not found).

## Penyebab
Backend container Docker (`takota-api`) menggunakan binary lama yang tidak memiliki route `/api/admin/export/report-data`. Meskipun kode sudah benar di repository, container perlu di-rebuild untuk menggunakan binary terbaru.

## Solusi yang Telah Diterapkan

### 1. Verifikasi Kode
✅ **File API sudah benar** (`web/src/admin/lib/api.js`)
- Fungsi `fetchAttendanceReportData()` sudah ada di baris 254-265
- Memanggil endpoint `GET /api/admin/export/report-data`

✅ **File komponen sudah benar** (`web/src/admin/pages/AdminReports.jsx`)
- Menggunakan `fetchAttendanceReportData()` untuk mendapatkan data dari backend
- Menggunakan `downloadAttendanceReportPdf()` untuk render PDF di browser (client-side)
- Tidak ada referensi ke fungsi yang tidak ada

✅ **Backend route sudah terdaftar** (`cmd/api/main.go` baris 145)
```go
admin.GET("/export/report-data", adminCtrl.ExportAttendanceReportData)
```

✅ **Controller method sudah ada** (`internal/controllers/export_controller.go` baris 132-152)
```go
func (ctrl *AdminController) ExportAttendanceReportData(c *gin.Context) {
    // Implementation...
}
```

### 2. Rebuild Container
Container backend di-rebuild untuk menggunakan kode terbaru:

```bash
cd takota
docker-compose up -d --build api
```

## Cara Testing

### 1. Verifikasi Backend Endpoint
Test endpoint backend (tanpa auth):
```bash
curl -s "http://localhost:8080/api/admin/export/report-data?start_date=2024-07-01&end_date=2024-07-14" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response:**
- HTTP Status: 401 (bukan 404!)
- Body: `{"error":{"status":401,"message":"Need Authorization","code":"HEADER_AUTH_REQ"}}`

Status 401 berarti endpoint ditemukan, hanya perlu authentication.

### 2. Test dengan Authentication
Login sebagai admin dan gunakan token:
```bash
# Login dulu
TOKEN=$(curl -s http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -H "key-request: web" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Test endpoint dengan token
curl -s "http://localhost:8080/api/admin/export/report-data?start_date=2024-07-01&end_date=2024-07-14&du_name=PT%20Test&du_address=Jl%20Test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "key-request: web" | jq
```

**Expected Response:**
JSON object dengan struktur:
```json
{
  "status": 200,
  "message": "success",
  "data": {
    "pages": [
      {
        "namaDudi": "PT Test",
        "alamatDudi": "Jl Test",
        "blocks": [...]
      }
    ]
  }
}
```

### 3. Test via Browser (Full Flow)

1. **Login ke aplikasi:**
   - Buka http://localhost:5173
   - Login sebagai admin

2. **Navigasi ke halaman rekap:**
   - Klik menu "Laporan" → "Rekap & Unduh"
   - Atau langsung ke http://localhost:5173/admin/reports

3. **Generate PDF:**
   - Pilih tanggal mulai dan akhir
   - (Opsional) Isi nama DU/DI dan alamat
   - Pastikan format "PDF" dipilih
   - Pilih siswa yang ingin dimasukkan dalam rekap
   - Klik tombol "Buat & Unduh PDF"

4. **Verifikasi hasil:**
   - PDF akan otomatis terunduh
   - File bernama: `Rekap-Presensi_YYYY-MM-DD_YYYY-MM-DD.pdf`
   - Buka PDF untuk memastikan isinya benar

## Alur Kerja PDF Export

```
Browser (AdminReports.jsx)
    ↓
api.fetchAttendanceReportData()
    ↓
GET /api/admin/export/report-data
    ↓
Backend: ExportAttendanceReportData()
    ↓ (return JSON)
downloadAttendanceReportPdf()
    ↓
html2pdf.js (client-side rendering)
    ↓
PDF file downloaded
```

**Keuntungan approach ini:**
- ❌ Tidak perlu Chromium di server
- ✅ PDF dirender di browser user
- ✅ Backend hanya menyiapkan data JSON
- ✅ Lebih ringan dan cepat

## Troubleshooting

### Masih Error 404?
```bash
# 1. Pastikan container sudah rebuild
docker ps | grep takota-api

# 2. Cek log container
docker logs takota-api

# 3. Rebuild ulang dengan force
docker-compose down
docker-compose up -d --build

# 4. Test endpoint lagi
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8080/api/admin/export/report-data?start_date=2024-07-01&end_date=2024-07-14"
```

### Error lain saat generate PDF?
Buka browser console (F12) dan lihat error message. Kemungkinan:
- Token expired → Login ulang
- Data siswa kosong → Tambahkan data presensi dulu
- Library html2pdf gagal load → Refresh halaman

## Perubahan yang Dilakukan

✅ **Backend container di-rebuild**  
File yang relevan:
- `cmd/api/main.go` (route sudah ada)
- `internal/controllers/export_controller.go` (method sudah ada)
- `internal/controllers/export_report.go` (helper functions)

⚠️ **Tidak ada perubahan kode** - semua sudah benar sejak awal, hanya perlu rebuild container!

## Status
✅ **RESOLVED** - Backend endpoint sekarang berfungsi normal (return 401 authentication required, bukan 404 not found)
