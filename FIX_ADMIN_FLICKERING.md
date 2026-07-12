# Fix Admin Flickering - Infinite Loop

## Tanggal: 12 Juli 2026

## 🐛 Masalah

Setelah menambahkan auto-refresh polling di halaman admin, halaman **berkedip terus-menerus** tanpa henti:
- `/admin/attendance` - flickering non-stop
- `/admin/absences` - flickering non-stop  
- `/admin/users` - flickering non-stop

## 🔍 Root Cause Analysis

### Kode Bermasalah

```javascript
useEffect(() => {
  // ... initial load ...
  
  // Polling interval
  const intervalId = setInterval(() => {
    loadPage(pageIndex, lastIds, search, true)
  }, 15000)
  
  return () => {
    clearInterval(intervalId)
  }
}, [pageIndex, lastIds, search, loadPage]) // ❌ MASALAH DI SINI!
```

### Mengapa Infinite Loop?

**Flow yang terjadi**:
```
1. useEffect run pertama kali
   ↓
2. Fetch data dari API
   ↓
3. Update state `setLastIds([...])` ← lastIds berubah!
   ↓
4. useEffect dependencies berubah [pageIndex, lastIds, search, loadPage]
   ↓
5. useEffect run lagi! (re-create interval)
   ↓
6. Fetch data lagi
   ↓
7. Update lastIds lagi
   ↓
8. INFINITE LOOP! 🔄
```

**Penjelasan**:
- `lastIds` adalah array yang berubah **setiap kali** data di-fetch (untuk pagination)
- `lastIds` ada di dependencies array useEffect
- Setiap kali `lastIds` berubah → useEffect re-run → fetch data → `lastIds` berubah lagi
- Loop tanpa henti! 💥

## ✅ Solusi: useRef Pattern

### Konsep

Gunakan **useRef** untuk menyimpan nilai terbaru state **tanpa** memicu re-render atau effect dependencies:

```javascript
// State normal (trigger re-render)
const [pageIndex, setPageIndex] = useState(0)
const [lastIds, setLastIds] = useState([''])
const [search, setSearch] = useState('')

// Refs untuk polling (tidak trigger re-render)
const pageIndexRef = useRef(pageIndex)
const lastIdsRef = useRef(lastIds)
const searchRef = useRef(search)

// Sync refs dengan state
useEffect(() => {
  pageIndexRef.current = pageIndex
}, [pageIndex])

useEffect(() => {
  lastIdsRef.current = lastIds
}, [lastIds])

useEffect(() => {
  searchRef.current = search
}, [search])
```

### Polling dengan Refs

```javascript
// Initial load - run ONCE
useEffect(() => {
  let cancelled = false
  async function run() {
    setLoading(true)
    // ... fetch initial data ...
    setLoading(false)
  }
  run()
  return () => {
    cancelled = true
  }
}, []) // ✅ Empty dependencies - run once

// Polling - stable interval
useEffect(() => {
  const intervalId = setInterval(() => {
    // ✅ Use REFS, not state directly
    loadPage(pageIndexRef.current, lastIdsRef.current, searchRef.current, true)
  }, 15000)
  
  return () => {
    clearInterval(intervalId)
  }
}, [loadPage]) // ✅ Only depend on loadPage (stable)
```

### Keuntungan

✅ **Interval hanya dibuat 1x** - tidak di-recreate terus-menerus
✅ **Refs selalu punya nilai terbaru** - meskipun tidak di dependencies
✅ **No infinite loop** - refs tidak trigger effect re-run
✅ **Polling tetap mengikuti current page/search** - via refs

## 🔧 Files Modified

### 1. AdminAttendance.jsx

**Changes**:
```javascript
// Import useRef
import { useCallback, useEffect, useState, useRef } from 'react'

// Add refs
const pageIndexRef = useRef(pageIndex)
const lastIdsRef = useRef(lastIds)
const searchRef = useRef(search)

// Sync refs
useEffect(() => { pageIndexRef.current = pageIndex }, [pageIndex])
useEffect(() => { lastIdsRef.current = lastIds }, [lastIds])
useEffect(() => { searchRef.current = search }, [search])

// Separate effects
useEffect(() => {
  // Initial load only
}, [])

useEffect(() => {
  // Polling with refs
  const intervalId = setInterval(() => {
    loadPage(pageIndexRef.current, lastIdsRef.current, searchRef.current, true)
  }, 15000)
  return () => clearInterval(intervalId)
}, [loadPage])
```

### 2. AdminAbsence.jsx

**Same pattern** - useRef untuk mencegah infinite loop

### 3. AdminUsers.jsx

**Same pattern** - useRef untuk mencegah infinite loop

## 🧪 Testing

### Test No More Flickering

1. **Buka halaman admin**: `/admin/users`
2. **Observe**: 
   - Loading spinner muncul **1x** saat initial load
   - Setelah data muncul, **TIDAK ADA** flickering lagi
   - Tunggu 15-30 detik
   - **Expected**: Halaman tetap stable, tidak berkedip

3. **Test auto-refresh masih bekerja**:
   - Buka 2 tab admin
   - Di tab 1: create user baru
   - Di tab 2: tunggu 15 detik
   - **Expected**: User baru muncul otomatis (silent refresh)

### Test Pagination Tetap Normal

1. Navigate ke page 2
2. **Observe**: Tidak ada flickering meskipun pageIndex berubah
3. Data page 2 muncul dengan benar

### Test Search Tetap Normal

1. Cari user dengan keyword
2. **Observe**: Tidak ada flickering meskipun search term berubah
3. Result search muncul dengan benar

## 📊 Comparison

### ❌ Sebelum Fix

```
useEffect dependencies: [pageIndex, lastIds, search, loadPage]
                              ↓          ↓        ↓
                        Berubah!  Berubah!  Berubah!
                              ↓          ↓        ↓
                         useEffect re-run terus-menerus
                              ↓
                         FLICKERING! 💥
```

### ✅ Sesudah Fix

```
useEffect dependencies: [loadPage] (stable)
                              ↓
                    Tidak berubah (useCallback)
                              ↓
                    useEffect HANYA run 1x
                              ↓
                    Interval polling stabil
                              ↓
                    Uses refs untuk state terbaru
                              ↓
                    NO FLICKERING! ✅
```

## 🎓 Lesson Learned

### ⚠️ Jangan Lakukan Ini

```javascript
// ❌ BAD - array state di dependencies
useEffect(() => {
  const interval = setInterval(() => {
    doSomething(myArray) // myArray berubah setiap update
  }, 1000)
  return () => clearInterval(interval)
}, [myArray]) // ❌ Infinite loop!
```

### ✅ Lakukan Ini

```javascript
// ✅ GOOD - use refs untuk state yang sering berubah
const myArrayRef = useRef(myArray)

useEffect(() => {
  myArrayRef.current = myArray
}, [myArray])

useEffect(() => {
  const interval = setInterval(() => {
    doSomething(myArrayRef.current) // Always current value
  }, 1000)
  return () => clearInterval(interval)
}, []) // ✅ Stable interval
```

## 🔑 Key Takeaways

1. **useEffect dependencies = re-run trigger**
   - Jika dependency berubah → effect run lagi
   - Array/object baru setiap render = always different

2. **useRef = escape hatch**
   - Ref tidak trigger re-render
   - Ref tidak trigger effect re-run
   - Perfect untuk polling/interval

3. **Separate concerns**
   - Initial load → useEffect dengan `[]`
   - Polling → useEffect terpisah dengan stable dependencies
   - Sync refs → useEffect kecil per state

4. **Always cleanup intervals**
   - Return cleanup function di useEffect
   - clearInterval saat unmount
   - Prevent memory leak

## ✅ Status

- ✅ AdminAttendance.jsx - **FIXED**
- ✅ AdminAbsence.jsx - **FIXED**
- ✅ AdminUsers.jsx - **FIXED**
- ✅ Main.jsx (user page) - **Tidak perlu fix** (sudah benar dengan flag `isInitialLoad`)

**All admin pages now have stable auto-refresh without flickering!** 🎉
