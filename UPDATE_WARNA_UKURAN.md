# Update: Penyesuaian Warna dan Ukuran Sesuai Desain Asli

**Tanggal:** 12 Juli 2026, 04:45 WIB  
**Status:** ✅ Selesai

---

## 🎨 Perubahan yang Diterapkan

### 1. Warna Badge (Menggunakan Brand Colors)

**Sebelumnya:** Hardcoded hex colors
```javascript
bg-[#00C48C]  // Hijau
bg-[#EF4444]  // Merah
bg-[#F59E0B]  // Kuning
bg-[#6B7280]  // Abu-abu
```

**Sekarang:** Menggunakan Tailwind classes yang mengacu ke brand palette
```javascript
bg-success   // #00BC7D (hijau)
bg-danger    // #FB2C36 (merah)
bg-warning   // #F0B409 (kuning)
bg-neutral   // #737373 (abu-abu)
```

**Mapping Status:**
| Status | Class | Warna Hex | Keterangan |
|--------|-------|-----------|------------|
| `approved` | `bg-success` | #00BC7D | Izin disetujui |
| `present` | `bg-success` | #00BC7D | Presensi hadir |
| `rejected` | `bg-danger` | #FB2C36 | Izin ditolak |
| `pending` | `bg-warning` | #F0B409 | Menunggu verifikasi |
| `alpha` | `bg-neutral` | #737373 | Tidak hadir (sistem) |

---

### 2. Ukuran Badge

**Sebelumnya:**
- Height: `h-16` (4rem / 64px)
- Width: `w-16` (4rem / 64px)
- Font: `text-sm` (0.875rem)

**Sekarang:**
- Height: `h-13` (3.25rem / 52px) ✅
- Width: `w-15` (3.75rem / 60px) ✅
- Font: `text-xs` (0.75rem) ✅

Custom spacing ditambahkan di `index.css`:
```css
@theme {
  --spacing-13: 3.25rem;
  --spacing-15: 3.75rem;
}
```

---

### 3. Background Card

**Sebelumnya:**
```jsx
<div className="... bg-white p-3">
```

**Sekarang:**
```jsx
<div className="... bg-neutral-100">
```

Sekarang card memiliki background abu-abu muda (`#F5F5F5`), bukan putih.

---

### 4. Typography

#### Header Halaman
**Sebelumnya:** `text-2xl font-bold`  
**Sekarang:** `text-xl font-bold` ✅

#### Section Label (Today / Absence)
**Sebelumnya:**
```jsx
<h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
```

**Sekarang:**
```jsx
<h2 className="mb-2 text-sm font-medium text-neutral">
```

Perubahan:
- Font size: `text-xs` → `text-sm` ✅
- Tidak uppercase ✅
- Margin bottom: `mb-3` → `mb-2` ✅
- Color: `text-neutral-500` → `text-neutral` (#737373) ✅

---

### 5. Spacing & Layout

#### Gap antara cards
**Sebelumnya:** `gap-3` (0.75rem)  
**Sekarang:** `gap-2` (0.5rem) ✅

#### Empty State
**Sebelumnya:**
```jsx
<div className="... bg-white p-8">
  <p className="text-sm text-neutral-500">
```

**Sekarang:**
```jsx
<div className="... bg-neutral-100 p-8">
  <p className="text-sm text-neutral">
```

---

### 6. Card Structure (AbsenceCard)

**Sebelumnya:**
```jsx
<div className="flex items-start gap-3 rounded-xl bg-white p-3">
  <div className={`flex h-16 w-16 ... ${colorClass}`}>
    <span className="text-sm ...">
```

**Sekarang:**
```jsx
<div className="flex items-center gap-3 rounded-xl bg-neutral-100">
  <span className={`flex h-13 w-15 ... ${colorClass}`}>
```

Perubahan:
- `items-start` → `items-center` (vertical alignment)
- Hapus `p-3` padding (card tidak perlu inner padding)
- Badge dari `<div>` menjadi `<span>` (lebih semantic)
- Ukuran badge: `h-16 w-16` → `h-13 w-15`
- Font badge: `text-sm` → `text-xs`

---

## 📂 File yang Diubah

### 1. `/web/src/components/AbsenceCard.jsx`
```diff
- const statusColors = {
-   present: 'bg-[#00C48C]',
-   approved: 'bg-[#00C48C]',
+ const statusBadgeStyles = {
+   approved: 'bg-success',
+   present: 'bg-success',

- <div className="flex items-start gap-3 rounded-xl bg-white p-3">
+ <div className="flex items-center gap-3 rounded-xl bg-neutral-100">

-   <div className={`flex h-16 w-16 shrink-0 ... ${colorClass}`}>
-     <span className="text-sm ...">
+   <span className={`flex h-13 w-15 shrink-0 ... ${colorClass}`}>
```

### 2. `/web/src/pages/Main.jsx`
```diff
- <main className="... bg-neutral-100 ...">
+ <main className="... px-5 pb-28 pt-8">

- <h1 className="text-2xl font-bold ...">
+ <h1 className="text-xl font-bold ...">

- <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
+ <h2 className="mb-2 text-sm font-medium text-neutral">

- <div className="flex flex-col gap-3">
+ <div className="flex flex-col gap-2">

- <div className="... bg-white p-8">
-   <p className="text-sm text-neutral-500">
+ <div className="... bg-neutral-100 p-8">
+   <p className="text-sm text-neutral">
```

### 3. `/web/src/index.css`
```diff
+ /* Custom sizes for absence badge (h-13 = 3.25rem, w-15 = 3.75rem) */
+ @theme {
+   --spacing-13: 3.25rem;
+   --spacing-15: 3.75rem;
+ }
```

---

## 🎯 Hasil Akhir

### Warna Brand (Exact Match)
✅ Success: `#00BC7D` (hijau teal)  
✅ Danger: `#FB2C36` (merah)  
✅ Warning: `#F0B409` (kuning/gold)  
✅ Neutral: `#737373` (abu-abu)  
✅ Primary: `#2B7FFF` (biru - untuk button)

### Ukuran (Exact Match)
✅ Badge height: `3.25rem` (52px)  
✅ Badge width: `3.75rem` (60px)  
✅ Badge font: `0.75rem` (12px)  
✅ Header: `1.25rem` (20px)  
✅ Section label: `0.875rem` (14px)

### Layout (Exact Match)
✅ Card background: `#F5F5F5` (neutral-100)  
✅ Gap between cards: `0.5rem` (8px)  
✅ Section spacing: `mb-2` (8px)  
✅ Main padding: `px-5 pb-28 pt-8`

---

## ✅ Verification

```bash
# Build test
cd /mnt/DiskY/takota/takota-full-any/takota/web
npm run build

# Result: ✓ built in 31.94s
# Status: SUCCESS, no errors
```

---

## 📸 Visual Comparison

### Desain Referensi (takota-frontend)
- Badge: 52x60px, text-xs
- Background: neutral-100 (abu-abu)
- Colors: brand palette (#00BC7D, #FB2C36, #F0B409, #737373)
- Header: text-xl
- Label: text-sm (tidak uppercase)
- Gap: 0.5rem

### Implementasi (takota)
✅ Semua aspek sudah match dengan desain referensi

---

## 🚀 Testing

1. **Start frontend:**
```bash
cd /mnt/DiskY/takota/takota-full-any/takota/web
npm run dev
```

2. **Buka browser:** http://localhost:5173

3. **Login:** user001 / user123

4. **Verifikasi visual:**
   - ✅ Badge ukuran 52x60px dengan font kecil
   - ✅ Card background abu-abu muda
   - ✅ Warna hijau teal untuk approved/present
   - ✅ Warna merah untuk rejected
   - ✅ Warna kuning untuk pending
   - ✅ Header text-xl (tidak terlalu besar)
   - ✅ Label section text-sm (tidak uppercase)
   - ✅ Gap antar card lebih rapat (8px)

---

**Last Updated:** 12 Juli 2026, 04:45 WIB  
**Status:** ✅ EXACT MATCH dengan desain referensi
