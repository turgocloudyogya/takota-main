# Pembaruan Desain Halaman Main (/main)

**Tanggal:** 12 Juli 2026, 04:35 WIB  
**Status:** ✅ Selesai diimplementasi

---

## 🎨 Perubahan Desain

### 1. Layout & Background
- ✅ Background halaman: `bg-neutral-100` (abu-abu terang)
- ✅ Card komponen: `bg-white` dengan rounded corners
- ✅ Max width: `max-w-md` untuk tampilan mobile-friendly
- ✅ Padding: `px-5 pb-28 pt-8`

### 2. Header Sapaan
- ✅ Teks besar, bold: `text-2xl font-bold`
- ✅ Format: "Good Morning, [Nama] 👋"
- ✅ Sapaan dinamis berdasarkan waktu:
  - 00:00 - 10:59: Good Morning
  - 11:00 - 14:59: Good Afternoon
  - 15:00 - 17:59: Good Evening
  - 18:00 - 23:59: Good Night
- ✅ Nama diambil dari `data.greeting_widget.name`

### 3. Section "Today" - Status Presensi Hari Ini
- ✅ Label section: `text-xs font-medium uppercase` dengan warna `text-neutral-500`
- ✅ **State A (Belum presensi):**
  - Box putih dengan background `bg-white`
  - Teks abu-abu: "No attendance status yet"
  - Padding `p-8` untuk spacing yang baik
- ✅ **State B (Sudah presensi):**
  - Component `AbsenceCard` dengan status `present`
  - Badge hijau (`bg-[#00C48C]`) di kiri dengan tanggal DD/MM
  - Title: "Present on DD/MM/YYYY"
  - Subtitle: "Location on [Kota, Kabupaten]"

### 4. Section "Absence" - Riwayat Izin
- ✅ Label section: sama dengan "Today"
- ✅ Maksimal 3 item terbaru (`.slice(0, 3)`)
- ✅ Empty state: "There is no absence list" dengan styling sama seperti Today

### 5. Komponen Baru: AbsenceCard

File: `/web/src/components/AbsenceCard.jsx`

#### Props:
- `date` (string): Tanggal format DD/MM
- `status` (string): Status badge - 'present' | 'approved' | 'rejected' | 'pending' | 'alpha'
- `title` (string): Judul card (reason dari absence)
- `subtitle` (string): Subtitle (verifikator/status)

#### Sistem Warna Badge:
| Status | Warna | Hex | Kapan Dipakai |
|--------|-------|-----|---------------|
| `present` | Hijau | `#00C48C` | Presensi hadir hari ini |
| `approved` | Hijau | `#00C48C` | Izin disetujui admin |
| `rejected` | Merah | `#EF4444` | Izin ditolak admin |
| `pending` | Kuning | `#F59E0B` | Izin menunggu verifikasi |
| `alpha` | Abu-abu | `#6B7280` | Tidak hadir tanpa izin |

#### Struktur Visual:
```
┌─────────────────────────────────────┐
│ ┌──────┐  Title (bold, semibold)   │
│ │      │  Subtitle (text-xs, gray) │
│ │ Date │                            │
│ │      │                            │
│ └──────┘                            │
└─────────────────────────────────────┘
```

- Badge tanggal: `h-16 w-16` dengan rounded `rounded-lg`
- Text tanggal: `text-sm font-semibold text-white` (center aligned)
- Title: `text-sm font-semibold text-neutral-900`
- Subtitle: `text-xs text-neutral-600`

---

## 🔄 Mapping Data dari API

### Response Format dari Backend:
```json
{
  "data": {
    "greeting_widget": {
      "name": "User Name",
      "time": "morning",
      "title": "Good Morning, User Name 👋"
    },
    "today": {
      "type": "attendance",
      "timestamp": "2026-07-11T10:30:00Z"
    },
    "absence": [
      {
        "type": "absence",
        "option": "sick",
        "reason": "Izin karena sedang sakit",
        "verify": {
          "user_id": "xxx",
          "username": "admin",
          "sign_status": "allow"
        }
      }
    ]
  }
}
```

### Mapping ke Component:

#### Today Section:
```javascript
if (data.today) {
  const timestamp = data.today.timestamp
  setTodayStatus({
    date: formatDate(timestamp),        // "03/07"
    status: 'present',
    title: `Present on ${formatFullDate(timestamp)}`,  // "Present on 03/07/2026"
    subtitle: 'Location on Yogyakarta, Sleman',
  })
}
```

#### Absence Section:
```javascript
data.absence.slice(0, 3).map((item) => {
  let status = 'pending'
  let subtitle = 'Submitting an absence request'
  
  if (item.verify && item.verify.sign_status) {
    const signStatus = item.verify.sign_status.toLowerCase()
    const verifierName = item.verify.username || 'Admin'
    
    if (signStatus === 'allow') {
      status = 'approved'
      subtitle = `${item.option === 'sick' ? 'S' : 'I'} • Verified by ${verifierName}`
    } else if (signStatus === 'reject') {
      status = 'rejected'
      subtitle = `${item.option === 'sick' ? 'S' : 'I'} • Verified by ${verifierName}`
    }
  }
  
  return {
    date: formatDate(item.timestamp),    // "03/07"
    status: status,
    title: item.reason,                  // "Izin karena sedang sakit"
    subtitle: subtitle,
  }
})
```

---

## 📝 Format Subtitle Berdasarkan Status

| Status | Format Subtitle | Contoh |
|--------|-----------------|---------|
| **Pending** | "Submitting an absence request" | "Submitting an absence request" |
| **Approved** | "[Kode] • Verified by [Nama Admin]" | "S • Verified by Wirawan Yogiyanto" |
| **Rejected** | "[Kode] • Verified by [Nama Admin]" | "I • Verified by Wirawan Yogiyanto" |
| **Alpha** | "By system" | "By system" |
| **Present** | "Location on [Kota, Kabupaten]" | "Location on Yogyakarta, Sleman" |

Kode:
- `S` = Sick (sakit)
- `I` = Izin/Permission

---

## 🎯 Fitur yang Masih Perlu Ditambahkan

### 1. Location Detection (Present)
Saat ini hardcoded: `"Location on Yogyakarta, Sleman"`

**TODO:**
- Ambil location dari data attendance
- Reverse geocoding dari latitude/longitude ke nama kota
- Atau simpan location name saat submit attendance

### 2. Timestamp untuk Absence Date
Saat ini hardcoded: `"03/07"`

**TODO:**
- Backend perlu menambahkan `timestamp` atau `created_at` di response absence list
- Frontend map timestamp ke format DD/MM

### 3. Alpha Status (Tidak Hadir)
Belum diimplementasi di backend

**TODO:**
- Sistem otomatis generate "Alpha" untuk user yang tidak presensi
- Status alpha tampil dengan badge abu-abu
- Subtitle: "Absent on DD/MM/YYYY" dan "By system"

---

## ✅ Testing Checklist

- [x] Komponen `AbsenceCard` dibuat dengan 5 varian warna
- [x] Halaman `Main.jsx` diperbarui dengan desain baru
- [x] Background abu-abu terang (`bg-neutral-100`)
- [x] Section "Today" dengan 2 state (belum/sudah presensi)
- [x] Section "Absence" maksimal 3 item
- [x] Empty state untuk "No attendance" dan "No absence"
- [x] Header sapaan dengan emoji 👋
- [x] Greeting dinamis berdasarkan waktu
- [ ] Test di browser untuk verifikasi visual
- [ ] Test dengan data real dari API
- [ ] Verifikasi warna badge sesuai desain
- [ ] Verifikasi typography (font size, weight)

---

## 🚀 Cara Testing

1. **Start Backend & Frontend:**
```bash
# Backend
cd /mnt/DiskY/takota/takota-full-any/takota
go run cmd/api/main.go

# Frontend (terminal lain)
cd web
npm run dev
```

2. **Login sebagai User:**
```
URL: http://localhost:5173
Username: user001
Password: user123
```

3. **Verifikasi Halaman /main:**
- Header sapaan muncul dengan nama user
- Section "Today" menampilkan "No attendance status yet" (jika belum presensi)
- Section "Absence" menampilkan maksimal 3 riwayat
- Badge warna sesuai status (hijau/merah/kuning)
- Typography dan spacing sesuai desain

4. **Submit Attendance:**
- Klik FAB button "Attendance"
- Pilih "Attendance"
- Submit dengan foto dan GPS
- Kembali ke /main
- Verifikasi section "Today" berubah menjadi card hijau "Present"

5. **Submit Absence:**
- Klik FAB button "Attendance"
- Pilih "Absence"
- Submit izin dengan alasan
- Kembali ke /main
- Verifikasi muncul di section "Absence" dengan badge kuning (pending)

6. **Admin Approve/Reject:**
- Login sebagai admin
- Approve atau reject absence
- Login kembali sebagai user
- Verifikasi badge berubah menjadi hijau (approved) atau merah (rejected)

---

## 📂 File yang Diubah

1. ✅ `/web/src/components/AbsenceCard.jsx` - **BARU**
2. ✅ `/web/src/pages/Main.jsx` - **DIUBAH**
3. ✅ `/web/src/admin/lib/normalize.js` - **FIX** (verify.sign_status mapping)
4. ✅ `/web/src/admin/pages/AdminAbsence.jsx` - **FIX** (ganti 'deny' → 'reject')
5. ✅ `/web/src/admin/components/StatusChip.jsx` - **FIX** (tambah 'reject')

---

## 🐛 Bug Fixes Terkait

Sebelum mengupdate desain, sudah diperbaiki bug approval absence:

1. **Frontend menggunakan 'deny', backend expect 'reject'**
   - Fixed: Semua 'deny' diganti menjadi 'reject'

2. **normalize.js tidak mengambil sign_status dari verify object**
   - Fixed: Tambah `raw.verify?.sign_status` di mapping

3. **StatusChip tidak support 'reject'**
   - Fixed: Tambah `reject: { label: 'Ditolak', color: 'danger' }`

---

**Last Updated:** 12 Juli 2026, 04:35 WIB  
**Status:** ✅ COMPLETE - Ready for Testing
