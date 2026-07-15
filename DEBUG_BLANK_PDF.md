# Debug: PDF Blank/Putih Setelah Diunduh

## Masalah
PDF berhasil diunduh tapi hasilnya blank/putih (tidak ada konten).

## Kemungkinan Penyebab

1. **Data dari backend kosong** - API mengembalikan array pages kosong
2. **HTML tidak ter-render** - buildPagesHtml() menghasilkan string kosong
3. **CSS tidak ter-load** - html2canvas gagal render karena style hilang
4. **onclone callback terlalu agresif** - Menghapus style yang diperlukan
5. **Timing issue** - Container belum siap saat html2pdf mulai render

## Langkah Debugging

### Step 1: Cek Data dari Backend

Buka browser console (F12) saat generate PDF, cari log seperti ini:

```
[PDF Debug] Document data: {pages: Array(2)}
[PDF Debug] Pages count: 2
```

**Jika pages count = 0:**
- Backend tidak mengembalikan data
- Cek apakah ada data presensi di database untuk tanggal yang dipilih
- Cek apakah siswa yang dipilih punya data

**Test manual di console:**
```javascript
// Login dulu, lalu test endpoint
const token = localStorage.getItem('takota_token')
fetch('http://localhost:8080/api/admin/export/report-data?start_date=2024-07-01&end_date=2024-07-14&student_ids=SISWA_ID', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'key-request': 'web'
  }
})
.then(r => r.json())
.then(d => console.log('Backend response:', d))
```

### Step 2: Cek HTML yang Di-generate

Lihat log:
```
[PDF Debug] Generated HTML length: 5423
[PDF Debug] Generated HTML preview: <div class="page">...
```

**Jika length = 0 atau sangat kecil (<100):**
- `buildPagesHtml()` tidak menghasilkan HTML
- Data pages mungkin undefined atau formatnya salah

**Test manual di console:**
```javascript
// Setelah log muncul, cek container di DOM
const container = document.querySelector('.attendance-report-root')
console.log('Container:', container)
console.log('Container HTML:', container?.innerHTML)
console.log('Container visible?', container?.offsetHeight > 0)
```

### Step 3: Cek CSS Injection

```javascript
// Cek apakah style sudah di-inject
const style = document.getElementById('attendance-report-print-style')
console.log('Report style exists:', !!style)
console.log('Report style content:', style?.textContent.length)
```

**Jika style tidak ada:**
- `ensureStyleInjected()` gagal
- Tambahkan error handling

### Step 4: Test Tanpa onclone

Edit file `attendanceReportHtml.js`, comment out bagian `onclone`:

```javascript
html2canvas: {
  scale: 2,
  useCORS: true,
  backgroundColor: '#ffffff',
  // Comment out onclone temporarily
  /*
  onclone: (clonedDoc) => {
    clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove())
    clonedDoc.querySelectorAll('style').forEach((el) => {
      if (el.id !== REPORT_STYLE_ID) el.remove()
    })
    clonedDoc.body.style.backgroundColor = '#ffffff'
    clonedDoc.body.style.color = '#000000'
  },
  */
},
```

**Jika masih blank:**
- Masalah bukan di onclone
- Kemungkinan data atau HTML generation

**Jika jadi ada konten:**
- onclone menghapus sesuatu yang diperlukan
- Perlu refine selector di onclone

### Step 5: Inspect Container Before Conversion

Tambahkan breakpoint atau delay sebelum html2pdf:

```javascript
export async function downloadAttendanceReportPdf(doc, filename) {
  // ... kode sebelumnya ...
  
  document.body.appendChild(container)
  
  // DEBUG: Tampilkan container sejenak untuk inspect
  container.style.left = '0'  // Pindahkan ke layar
  container.style.top = '0'
  container.style.zIndex = '99999'
  
  await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
  
  // Lanjutkan ke html2pdf...
}
```

Saat 3 detik tunggu, **screenshot container** atau inspect di DevTools.

**Yang harus terlihat:**
- Tabel dengan border hitam
- Nama siswa
- Tanggal
- Checkmark (√), S, I, A di cell
- Header "Nama DU/DI" dan "Alamat DU/DI"

**Jika tidak terlihat apa-apa:**
- HTML kosong → cek data backend
- HTML ada tapi tidak visible → cek CSS

### Step 6: Check html2pdf Options

Test dengan opsi minimal:

```javascript
await html2pdf()
  .set({
    filename,
    margin: 10,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { 
      scale: 2,
      logging: true,  // Enable logging
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'landscape' 
    },
  })
  .from(container)
  .save()
```

Cek console untuk log dari html2canvas.

## Solusi Berdasarkan Temuan

### Solusi 1: Data Backend Kosong

**Penyebab:** Tidak ada data presensi di database

**Fix:**
1. Tambahkan data presensi dummy untuk testing
2. Pastikan tanggal yang dipilih ada datanya
3. Cek timezone - mungkin `created_at` di database pakai UTC tapi query pakai local

**Test query:**
```sql
SELECT * FROM attendances 
WHERE created_at >= '2024-07-01' 
  AND created_at < '2024-07-15'
ORDER BY created_at DESC
LIMIT 10;
```

### Solusi 2: Struktur Data Tidak Sesuai

**Penyebab:** Frontend expect format berbeda dari backend

**Fix:** Verify API response structure matches PDFTemplateData:
```json
{
  "status": 200,
  "message": "success",
  "data": {
    "pages": [
      {
        "namaDudi": "PT Test",
        "alamatDudi": "Jl Test",
        "blocks": [
          {
            "hariLabel": ["Senin", "Selasa", ...],
            "tanggal": ["01", "02", ...],
            "siswa": [
              {
                "nama": "Budi",
                "marks": ["√", "S", "I", "A", ...],
                "s": 1,
                "i": 1,
                "a": 1
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Solusi 3: API Response Wrapper

**Penyebab:** Backend mengembalikan `{status, message, data}` tapi frontend expect langsung `{pages}`

**Check di api.js:**
```javascript
export async function fetchAttendanceReportData({ ... }) {
  const response = await request('/api/admin/export/report-data', { ... })
  
  // PENTING: Utils.RespondSuccess mengembalikan wrapper
  // Pastikan mengembalikan response.data, bukan response
  return response.data || response
}
```

### Solusi 4: CSS Tidak Ter-apply

**Penyebab:** onclone menghapus REPORT_STYLE_ID juga

**Fix:** Pastikan condition di onclone benar:
```javascript
onclone: (clonedDoc) => {
  // Remove all stylesheets EXCEPT our report style
  clonedDoc.querySelectorAll('style').forEach((el) => {
    if (el.id !== REPORT_STYLE_ID) {
      el.remove()
    }
  })
  // Keep our report style!
  const reportStyle = clonedDoc.getElementById(REPORT_STYLE_ID)
  if (!reportStyle) {
    console.error('Report style not found in clone!')
  }
}
```

### Solusi 5: Timing Issue

**Penyebab:** html2pdf mulai render sebelum DOM ready

**Fix:** Tambah delay kecil:
```javascript
document.body.appendChild(container)

// Give browser a tick to compute layout
await new Promise(resolve => requestAnimationFrame(resolve))
await new Promise(resolve => requestAnimationFrame(resolve))

// Now convert to PDF
const { default: html2pdf } = await import('html2pdf.js')
await html2pdf() // ...
```

## Quick Fix (Most Common Issue)

Berdasarkan pengalaman, masalah paling umum adalah **API response wrapper**. Coba fix ini dulu:

**File: `web/src/admin/lib/api.js`**

Cari fungsi `fetchAttendanceReportData`, pastikan return `response.data`:

```javascript
export async function fetchAttendanceReportData({
  startDate,
  endDate,
  duName = '',
  duAddress = '',
  studentIds = [],
} = {}) {
  const response = await request('/api/admin/export/report-data', {
    params: {
      start_date: startDate,
      end_date: endDate,
      du_name: duName || undefined,
      du_address: duAddress || undefined,
      student_ids: studentIds.length > 0 ? studentIds.join(',') : undefined,
    },
  })
  
  // Backend mengembalikan { status: 200, message: "success", data: {...} }
  // Kita butuh data.pages, bukan data saja
  console.log('[API Debug] Full response:', response)
  console.log('[API Debug] Response.data:', response.data)
  
  return response.data || response
}
```

## Testing Checklist

- [ ] Console log shows "Document data" with non-empty pages array
- [ ] Console log shows "Generated HTML length" > 1000
- [ ] Container element appears in DOM (even if off-screen)
- [ ] Style element with id "attendance-report-print-style" exists
- [ ] No errors in console during PDF generation
- [ ] Downloaded PDF is not 0 bytes
- [ ] Opening PDF shows content (not blank)

## Jika Semua Gagal

**Nuclear option:** Test dengan data hardcoded:

```javascript
// Di AdminReports.jsx, sebelum panggil downloadAttendanceReportPdf:
const testDoc = {
  pages: [{
    namaDudi: 'TEST DU/DI',
    alamatDudi: 'TEST ALAMAT',
    blocks: [{
      hariLabel: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
      tanggal: ['01', '02', '03', '04', '05', '06', '08', '09', '10', '11', '12', '13'],
      siswa: [{
        nama: 'Test Siswa',
        marks: ['√', '√', 'S', '√', '√', '√', '√', 'I', '√', '√', '√', 'A'],
        s: 1,
        i: 1,
        a: 1
      }]
    }]
  }]
}

await downloadAttendanceReportPdf(testDoc, 'test.pdf')
```

**Jika hardcoded data berhasil:**
- Masalah di API atau data backend

**Jika hardcoded data juga blank:**
- Masalah di html2pdf setup atau browser compatibility

## Browser Compatibility

html2pdf.js might have issues with:
- Safari < 15
- Firefox with strict privacy settings
- Chrome with aggressive content blockers

**Test di Chrome Incognito** dengan extensions disabled.
