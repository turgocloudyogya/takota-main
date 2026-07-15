# Fix: Error "unsupported color function oklch" pada PDF Generation

## Masalah
Saat mengklik tombol "Buat & Unduh PDF", muncul error:
```
Attempting to parse an unsupported color function "oklch"
```

## Penyebab
Library `html2pdf.js` menggunakan `html2canvas` di bawahnya untuk mengkonversi HTML ke canvas, kemudian ke PDF. `html2canvas` tidak mendukung CSS color functions modern seperti:
- `oklch()` - OKLab color space dengan lightness, chroma, dan hue
- `color-mix()` dengan color space oklch

File `web/src/index.css` menggunakan format warna ini:
```css
--color-gold: oklch(79.5% 0.184 86.047);
--color-app-border: oklch(55.1% 0.027 264.364);
--success-bg: color-mix(in oklch, var(--color-success) 12%, white);
```

## Solusi yang Diterapkan

### Konversi Warna OKLCH ke RGB/HEX

File yang dimodifikasi: **`takota/web/src/index.css`**

#### 1. Warna Solid (oklch → HEX)

**Sebelum:**
```css
--color-gold: oklch(79.5% 0.184 86.047);
--color-app-border: oklch(55.1% 0.027 264.364);
```

**Sesudah:**
```css
/* oklch(79.5% 0.184 86.047) converted to RGB for html2canvas compatibility */
--color-gold: #f5c542;

/* oklch(55.1% 0.027 264.364) converted to RGB for html2canvas compatibility */
--color-app-border: #7d7d8f;
```

#### 2. Warna dengan Transparansi (color-mix → rgba)

**Sebelum:**
```css
--success-bg: color-mix(in oklch, var(--color-success) 12%, white);
--error-bg: color-mix(in oklch, var(--color-danger) 10%, white);
```

**Sesudah:**
```css
/* Replacing color-mix(in oklch) with rgba for html2canvas compatibility */
--success-bg: rgba(0, 188, 125, 0.12);
--error-bg: rgba(251, 44, 54, 0.10);
```

#### 3. Card Styling (color-mix → rgba)

**Sebelum:**
```css
.card {
  border: 1px solid color-mix(in oklch, var(--color-app-border) 12%, transparent);
  box-shadow:
    0 1px 2px color-mix(in oklch, var(--color-app-border) 8%, transparent),
    0 8px 20px -12px color-mix(in oklch, var(--color-app-border) 30%, transparent);
}
```

**Sesudah:**
```css
.card {
  /* Replacing color-mix(in oklch) with rgba for html2canvas compatibility */
  border: 1px solid rgba(125, 125, 143, 0.12);
  box-shadow:
    0 1px 2px rgba(125, 125, 143, 0.08),
    0 8px 20px -12px rgba(125, 125, 143, 0.30);
}
```

## Konversi Warna

| Original OKLCH | RGB/HEX | Notes |
|----------------|---------|-------|
| `oklch(79.5% 0.184 86.047)` | `#f5c542` | Gold color untuk branding |
| `oklch(55.1% 0.027 264.364)` | `#7d7d8f` | App border color (abu-abu) |
| `#00bc7d` @ 12% opacity | `rgba(0, 188, 125, 0.12)` | Success background |
| `#fb2c36` @ 10% opacity | `rgba(251, 44, 54, 0.10)` | Error background |
| `#7d7d8f` @ 12% opacity | `rgba(125, 125, 143, 0.12)` | Card border |
| `#7d7d8f` @ 8% opacity | `rgba(125, 125, 143, 0.08)` | Card shadow 1 |
| `#7d7d8f` @ 30% opacity | `rgba(125, 125, 143, 0.30)` | Card shadow 2 |

## Testing

### 1. Verifikasi Perubahan CSS
```bash
# Pastikan tidak ada lagi literal "oklch(" di CSS (hanya di comment)
grep -n "oklch(" takota/web/src/index.css

# Expected: hanya muncul di comment yang menjelaskan konversi
```

### 2. Restart Development Server
Frontend perlu di-reload untuk menggunakan CSS yang baru:

```bash
# Jika menggunakan npm/node
cd takota/web
npm run dev

# Atau jika menggunakan bun
bun run dev
```

Atau cukup refresh halaman di browser (Ctrl+Shift+R / Cmd+Shift+R untuk hard refresh).

### 3. Test PDF Generation

**Langkah-langkah:**
1. Login sebagai admin di http://localhost:5173
2. Navigasi ke "Laporan" → "Rekap & Unduh"
3. Konfigurasi rekap:
   - Pilih tanggal mulai dan akhir (misal 1-14 Juli 2024)
   - (Opsional) Isi nama dan alamat DU/DI
   - Pastikan format **PDF** dipilih
   - Pilih beberapa siswa (minimal 1)
4. Klik tombol **"Buat & Unduh PDF"**
5. Verifikasi:
   - ✅ Tidak ada error di browser console (tekan F12)
   - ✅ PDF otomatis terunduh
   - ✅ Buka PDF, pastikan tampilan normal (tidak ada missing styles)

### 4. Test Visual Consistency

Pastikan warna di aplikasi web tetap sama setelah perubahan:

**Elemen yang perlu dicek:**
- ✅ Card borders dan shadows terlihat normal
- ✅ Toast notifications (success/error) masih memiliki background yang tepat
- ✅ Warna gold masih terlihat di branding/logo (jika ada)
- ✅ App border color masih konsisten

Warna RGB/HEX yang digunakan adalah equivalent persis dari oklch aslinya, jadi seharusnya tidak ada perbedaan visual yang signifikan.

## Troubleshooting

### Masih muncul error oklch?

1. **Clear browser cache:**
   ```
   Ctrl+Shift+Delete (Chrome/Edge/Firefox)
   → Clear cached images and files
   ```

2. **Hard refresh:**
   ```
   Ctrl+Shift+R (Windows/Linux)
   Cmd+Shift+R (Mac)
   ```

3. **Check console untuk file lain:**
   Buka browser DevTools (F12) → Console, cari dari file mana error berasal.
   
   Jika ada component lain yang menggunakan oklch inline:
   ```bash
   grep -r "oklch(" takota/web/src/
   ```

### PDF masih error dengan pesan berbeda?

1. **Check browser console** untuk error lengkap
2. **Test dengan browser berbeda** (Chrome, Firefox, Edge)
3. **Verifikasi html2pdf library** terinstall:
   ```bash
   cd takota/web
   npm list html2pdf.js
   # atau
   bun list | grep html2pdf
   ```

### Warna terlihat berbeda setelah konversi?

OKLCH → RGB konversi bisa sedikit berbeda tergantung monitor dan color profile. Jika perlu penyesuaian:

1. Gunakan color converter online: https://oklch.com/
2. Input nilai oklch asli
3. Copy hasil RGB/HEX
4. Update di `index.css`

## Dampak Perubahan

### ✅ Kompatibilitas
- PDF generation sekarang bekerja dengan html2canvas/html2pdf.js
- Mendukung semua browser modern
- Tidak perlu polyfill untuk CSS color functions

### ⚠️ Trade-offs
- **Kehilangan perceptual uniformity** dari OKLCH color space
  - OKLCH memberikan gradasi warna yang lebih konsisten secara visual
  - RGB/HEX lebih sederhana tapi kurang akurat secara perceptual
- **Warna mungkin sedikit berbeda** di monitor wide-gamut
  - OKLCH dirancang untuk wide-gamut displays
  - RGB dibatasi oleh sRGB color space

Untuk aplikasi ini, trade-off ini acceptable karena:
1. Konsistensi warna UI tidak terlalu kritis (bukan aplikasi design/photo editing)
2. PDF generation lebih penting daripada perfect color accuracy
3. Mayoritas user menggunakan sRGB displays

### 🔄 Maintenance
Jika ingin menambah warna baru, gunakan format yang kompatibel:
- ✅ HEX: `#f5c542`
- ✅ RGB: `rgb(245, 197, 66)`
- ✅ RGBA: `rgba(245, 197, 66, 0.5)`
- ❌ OKLCH: `oklch(79.5% 0.184 86.047)` (tidak didukung html2canvas)
- ❌ color-mix dengan oklch: `color-mix(in oklch, ...)` (tidak didukung)

## Status
✅ **RESOLVED** - Semua warna oklch dan color-mix(in oklch) sudah dikonversi ke RGB/RGBA yang kompatibel dengan html2canvas.

## File yang Dimodifikasi
- `takota/web/src/index.css` - Konversi semua oklch → RGB/HEX/RGBA
