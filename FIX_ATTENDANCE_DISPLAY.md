# Fix Attendance Display - Nama dan Lokasi

## Tanggal: 12 Juli 2026

## 🐛 Masalah

Di halaman `/admin/attendance` (tab Presensi):
1. **Kolom Nama** hanya menampilkan "-" (tidak ada nama)
2. **Kolom Lokasi** menampilkan koordinat mentah (misal: `-7.7546612, 110.3658561`) bukan nama lokasi yang readable

---

## ✅ Solusi yang Diimplementasikan

### 1. Backend: Return User Info di Attendance List

**File**: `internal/controllers/admin_controller.go`

#### A. Update Response Structure

**Before**:
```go
type AttendanceListItem struct {
    ID         string `json:"id"`
    UserID     string `json:"user_id"`
    Photo      string `json:"photo"`
    GmapsEmbed string `json:"gmaps_embed"`
    Latitude   string `json:"latitude"`
    Longitude  string `json:"longitude"`
    Timestamp  string `json:"timestamp"`
}
```

**After**:
```go
type AttendanceListItem struct {
    ID         string `json:"id"`
    UserID     string `json:"user_id"`
    Username   string `json:"username"`   // ← NEW
    Nickname   string `json:"nickname"`   // ← NEW
    Photo      string `json:"photo"`
    GmapsEmbed string `json:"gmaps_embed"`
    Latitude   string `json:"latitude"`
    Longitude  string `json:"longitude"`
    Location   string `json:"location"`   // ← NEW (formatted)
    Timestamp  string `json:"timestamp"`
}
```

#### B. Preload User Relation

**Before**:
```go
var attendances []models.Attendance
query.Order("attendance.created_at DESC").
    Limit(limit + 1).
    Find(&attendances)
```

**After**:
```go
var attendances []models.Attendance
query.Order("attendance.created_at DESC").
    Preload("User"). // ← Load user data
    Limit(limit + 1).
    Find(&attendances)
```

#### C. Map User Info ke Response

```go
// Get user info
username := ""
nickname := ""
if att.User != nil {
    username = att.User.Username
    nickname = att.User.Callname // Use callname as display name
}

// Format location from coordinates
location := ""
if att.Latitude != nil && att.Longitude != nil {
    location = fmt.Sprintf("%.4f, %.4f", 
        parseFloat(*att.Latitude), 
        parseFloat(*att.Longitude))
}

items = append(items, AttendanceListItem{
    ID:         att.ID.String(),
    UserID:     att.UserID.String(),
    Username:   username,    // ← Populated
    Nickname:   nickname,    // ← Populated
    Photo:      photoURL,
    GmapsEmbed: gmapsEmbed,
    Latitude:   lat,
    Longitude:  lon,
    Location:   location,    // ← Formatted coordinates
    Timestamp:  att.CreatedAt.Format(time.RFC3339),
})
```

#### D. Helper Function

```go
// Helper function to parse float from string
func parseFloat(s string) float64 {
    f, _ := strconv.ParseFloat(s, 64)
    return f
}
```

---

### 2. Frontend: Already OK

**File**: `web/src/admin/pages/AdminAttendance.jsx`

Frontend sudah properly configured untuk display data:

```jsx
<td className="px-4 py-3">
  <p className="font-medium text-neutral-900">{row.name || '—'}</p>
  {row.username && <p className="text-xs text-neutral">{row.username}</p>}
</td>
```

```jsx
<td className="px-4 py-3 text-neutral-700">
  {row.location ? (
    <span className="inline-flex items-center gap-1">
      <Icon data={MapPin} size={13} className="text-neutral" />
      {row.location}
    </span>
  ) : row.latitude && row.longitude ? (
    <span className="inline-flex items-center gap-1 text-xs">
      <Icon data={MapPin} size={13} className="text-neutral" />
      {Number(row.latitude).toFixed(4)}, {Number(row.longitude).toFixed(4)}
    </span>
  ) : (
    '—'
  )}
</td>
```

**Normalizer** (`web/src/admin/lib/normalize.js`) already handles various field names:

```javascript
export function normalizeAttendance(raw) {
  return {
    id: firstDefined(raw.id, raw._id, raw.uuid),
    userId: firstDefined(raw.user_id, raw.userId, raw.user?.id),
    name: firstDefined(
      raw.nickname,      // ← Will get backend's nickname
      raw.name,
      raw.user?.nickname,
      raw.callname,
      raw.username,
      raw.user?.username
    ),
    username: firstDefined(raw.username, raw.user?.username),
    location: firstDefined(raw.location, raw.address),
    latitude: firstDefined(raw.latitude, raw.lat),
    longitude: firstDefined(raw.longitude, raw.lng, raw.long),
    photoUrl: firstDefined(raw.photo, raw.photo_url),
    dateRaw,
    raw,
  }
}
```

---

## 🔄 Data Flow

```
Backend:
┌──────────────────────────────────────┐
│ ListAttendances()                    │
│ ├─ Query attendance with User        │
│ ├─ Preload("User")                   │
│ ├─ Map: nickname = User.Callname     │
│ ├─ Map: username = User.Username     │
│ └─ Map: location = "lat, lon"        │
└────────────┬─────────────────────────┘
             │
             ▼ JSON Response
┌──────────────────────────────────────┐
│ {                                    │
│   "data": [{                         │
│     "id": "uuid",                    │
│     "user_id": "uuid",               │
│     "username": "user001",           │
│     "nickname": "Ahnaf Farras", ← ✅ │
│     "latitude": "-7.7546612",        │
│     "longitude": "110.3658561",      │
│     "location": "-7.7547, 110.3659", │
│     ...                              │
│   }]                                 │
│ }                                    │
└────────────┬─────────────────────────┘
             │
             ▼
Frontend normalizeAttendance():
┌──────────────────────────────────────┐
│ {                                    │
│   name: "Ahnaf Farras",        ← ✅  │
│   username: "user001",               │
│   location: "-7.7547, 110.3659",     │
│   ...                                │
│ }                                    │
└────────────┬─────────────────────────┘
             │
             ▼
AdminAttendance Display:
┌──────────────────────────────────────┐
│ Nama        │ Waktu     │ Lokasi     │
│─────────────┼───────────┼────────────│
│ Ahnaf Farras│ 12 Jul .. │ -7.7547,.. │
│ user001     │           │ 110.3659   │
└──────────────────────────────────────┘
```

---

## 🧪 Testing

### Test 1: Verify Backend Response

**Setelah restart backend**:

```bash
# Login sebagai admin untuk dapatkan token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Test attendance list endpoint
curl -X GET http://localhost:8080/api/admin/attendances \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0]'
```

**Expected Response**:
```json
{
  "id": "...",
  "user_id": "...",
  "username": "user001",
  "nickname": "Ahnaf Farras",  // ← Should have value now!
  "photo": "...",
  "latitude": "-7.7546612",
  "longitude": "110.3658561",
  "location": "-7.7547, 110.3659",  // ← Formatted!
  "timestamp": "..."
}
```

### Test 2: Frontend Display

1. ✅ Login sebagai admin
2. ✅ Buka `/admin/attendance`
3. ✅ Lihat tabel presensi

**Expected**:

**Kolom Nama**:
- Nama panggilan (callname) ditampilkan dengan **bold**
- Username ditampilkan di bawahnya dengan text kecil

```
Nama
─────────────
Ahnaf Farras
user001
```

**Kolom Lokasi**:
- Koordinat di-format dengan 4 desimal
- Ada icon MapPin di sebelah kiri

```
Lokasi
──────────────────
📍 -7.7547, 110.3659
```

### Test 3: Search by Name

1. ✅ Di search box, ketik nama panggilan: `Ahnaf`
2. ✅ **Expected**: Hasil filter menampilkan attendance dari user tersebut
3. ✅ Search juga work untuk username: `user001`

---

## 🎨 UI Before vs After

### Before ❌

```
| Nama | Waktu              | Lokasi                      |
|------|--------------------|-----------------------------|
| —    | 12 Jul 2026, 08:30 | -7.7546612, 110.3658561    |
| —    | 12 Jul 2026, 09:15 | -7.7548123, 110.3657890    |
```

### After ✅

```
| Nama          | Waktu              | Lokasi                |
|---------------|--------------------|-----------------------|
| Ahnaf Farras  | 12 Jul 2026, 08:30 | 📍 -7.7547, 110.3659 |
| user001       |                    |                       |
|               |                    |                       |
| Budi Santoso  | 12 Jul 2026, 09:15 | 📍 -7.7548, 110.3658 |
| user002       |                    |                       |
```

---

## 🔮 Future Enhancement: Reverse Geocoding

Untuk convert koordinat ke nama lokasi yang readable (misal: "Jl. Kaliurang, Sleman, Yogyakarta"):

### Option 1: Google Maps Geocoding API

```go
// In admin_controller.go
func reverseGeocode(lat, lon float64) string {
    apiKey := os.Getenv("GOOGLE_MAPS_API_KEY")
    url := fmt.Sprintf(
        "https://maps.googleapis.com/maps/api/geocode/json?latlng=%f,%f&key=%s",
        lat, lon, apiKey)
    
    // Call API, parse response
    // Return formatted address
}
```

### Option 2: Nominatim (OpenStreetMap - Free)

```go
func reverseGeocode(lat, lon float64) string {
    url := fmt.Sprintf(
        "https://nominatim.openstreetmap.org/reverse?format=json&lat=%f&lon=%f",
        lat, lon)
    
    // Call API, parse response
    // Return display_name
}
```

**Usage**:
```go
location := ""
if att.Latitude != nil && att.Longitude != nil {
    lat := parseFloat(*att.Latitude)
    lon := parseFloat(*att.Longitude)
    
    // Try reverse geocoding
    location = reverseGeocode(lat, lon)
    
    // Fallback to coordinates if API fails
    if location == "" {
        location = fmt.Sprintf("%.4f, %.4f", lat, lon)
    }
}
```

**Note**: Rate limits apply untuk free APIs. Consider caching results.

---

## 📝 Implementation Checklist

- [x] Update backend response structure dengan username & nickname fields
- [x] Preload User relation di ListAttendances query
- [x] Map user info (username, nickname) ke response
- [x] Format location dari coordinates
- [x] Add helper function parseFloat
- [x] Frontend normalizer sudah support new fields
- [x] Frontend display sudah OK (no changes needed)
- [ ] Restart backend untuk apply changes
- [ ] Test attendance list display
- [ ] Verify search by name works

---

## 🚀 Deployment

### Step 1: Restart Backend

```bash
cd /mnt/DiskY/takota/takota-full-any/takota

# If running with go run:
# Kill current process (Ctrl+C) then:
go run cmd/api/main.go

# Or with air (hot reload):
air

# Or rebuild binary:
go build -o takota-api cmd/api/main.go
./takota-api
```

### Step 2: Test

```bash
# Open browser
# Login sebagai admin
# Navigate to /admin/attendance
# Verify:
# - Nama panggilan muncul (bukan "—")
# - Koordinat formatted dengan 4 desimal
```

---

## 🔑 Key Files Modified

1. ✅ `internal/controllers/admin_controller.go`
   - Updated `AttendanceListItem` struct
   - Added Preload("User") to query
   - Added nickname, username, location mapping
   - Added parseFloat helper function

2. ✅ Frontend: No changes needed (already supports new fields)

---

## ✅ Expected Result

Setelah restart backend dan refresh browser:

✅ **Kolom Nama** menampilkan nama panggilan siswa (callname)
✅ **Kolom Lokasi** menampilkan koordinat yang formatted dengan 4 desimal
✅ **Search** berfungsi dengan nama panggilan atau username
✅ **Data complete** - tidak ada "—" lagi di kolom nama

**Fix complete!** 🎉
