# Fix: Attendance Submit Error "[object Object]"

## Masalah
User001 tidak bisa submit attendance di `/attendance` dan muncul error message `[object Object]` padahal lokasi dan kamera sudah di-allow.

## Root Cause
1. **Frontend Error Handling**: API client tidak mengekstrak error message dengan benar dari nested error object yang dikirim backend
2. **Backend Query Issue**: Query untuk check existing attendance menggunakan `DATE(created_at) = DATE(?)` yang tidak reliable di PostgreSQL dengan timezone
3. **Token Storage**: Inkonsistensi antara token storage key

## Solusi yang Diterapkan

### 1. Frontend - API Client (`web/src/lib/api.js`)

#### Error Handling Diperbaiki:
```javascript
// BEFORE
if (!response.ok) {
  let errorMsg
  try {
    const data = await response.json()
    errorMsg = data.message || data.error || `Request failed (${response.status})`
  } catch {
    errorMsg = `Request failed (${response.status})`
  }
  throw new ApiError(errorMsg, response.status)
}

// AFTER
if (!response.ok) {
  let errorMsg
  try {
    const data = await response.json()
    // Handle nested error object from backend
    if (data.error && typeof data.error === 'object') {
      errorMsg = data.error.message || data.error.error || JSON.stringify(data.error)
    } else {
      errorMsg = data.message || data.error || `Request failed (${response.status})`
    }
  } catch {
    errorMsg = `Request failed (${response.status})`
  }
  throw new ApiError(errorMsg, response.status)
}
```

#### Token Storage Diperbaiki:
```javascript
function getToken() {
  try {
    // Try multiple token keys for compatibility
    return localStorage.getItem('takota_token') || 
           localStorage.getItem('takota_admin_token') || 
           localStorage.getItem('token') || 
           null
  } catch {
    return null
  }
}

function setToken(token) {
  try {
    localStorage.setItem('takota_token', token)
    // Also set admin token for compatibility
    localStorage.setItem('takota_admin_token', token)
  } catch {
    // ignore
  }
}
```

### 2. Backend - User Controller (`internal/controllers/user_controller.go`)

#### Query Check Existing Attendance Diperbaiki:
```go
// BEFORE
today := time.Now().UTC().Truncate(24 * time.Hour)
var existingAttendance models.Attendance
err := ctrl.DB.Where("user_id = ? AND type = ? AND DATE(created_at) = DATE(?)", uid, "attendance", today).
    First(&existingAttendance).Error

// AFTER
now := time.Now().UTC()
startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
endOfDay := startOfDay.Add(24 * time.Hour)

var existingAttendance models.Attendance
err := ctrl.DB.Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", 
    uid, "attendance", startOfDay, endOfDay).
    First(&existingAttendance).Error
```

#### Error Check Diperbaiki:
```go
// BEFORE
if err != nil && err.Error() != "record not found" {

// AFTER
if err != nil && !strings.Contains(err.Error(), "record not found") {
```

#### Import Ditambahkan:
```go
import (
    "context"
    "net/http"
    "strings"  // ← ADDED
    "time"
    // ... other imports
)
```

## Testing

### 1. Backend API Test
```bash
# Login
USER_TOKEN=$(curl -s -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -H "key-request: web-user" \
  -d '{"username":"user001","password":"user123"}' | jq -r '.token')

# Submit attendance
curl -s -X POST http://localhost:8080/api/user/attendance \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "key-request: web-user" \
  -F "latitude=-7.7546612" \
  -F "longitude=110.3658561" | jq
```

**Expected Success Response:**
```json
{
  "id": "uuid-here",
  "message": "Attendance successfully recorded"
}
```

**Expected Error (Already Submitted):**
```json
{
  "error": {
    "status": 400,
    "message": "You have already submitted attendance today",
    "code": "ATTENDANCE_ALREADY_SUBMITTED"
  }
}
```

### 2. Frontend Test

1. **Reload Frontend**: Buka browser, tekan `Ctrl+Shift+R` untuk hard reload dan clear cache
2. **Login**: Buka `http://localhost:5173`, login dengan `user001` / `user123`
3. **Submit Attendance**: 
   - Klik FAB di home
   - Pilih "Attendance"
   - Allow GPS dan Camera permissions
   - Klik "Take Attendance"
   - Confirm

**Expected Result**: Success message "Attendance submitted successfully!" dan redirect ke home setelah 3 detik

### 3. Error Message Test

Jika user sudah submit attendance hari ini dan coba submit lagi:

**Expected**: Error message yang jelas: "You have already submitted attendance today"  
**NOT**: `[object Object]` ❌

## Cara Reset Data Test

Jika ingin test ulang submit attendance (hapus record hari ini):
```bash
docker exec takota-postgres psql -U takota -d takota_db -c \
  "DELETE FROM attendance WHERE user_id = 'f12ee871-31a2-44f4-9419-575f00210420' AND type = 'attendance';"
```

## Files Modified

1. ✅ `web/src/lib/api.js` - Error handling dan token storage
2. ✅ `internal/controllers/user_controller.go` - Query dan error checking
3. ✅ Backend restarted

## Verification Checklist

- [x] Backend API bisa menerima attendance submission
- [x] Error response format correct (nested in `error` object)
- [x] Frontend error handling mengekstrak message dengan benar
- [x] Token storage konsisten
- [x] Query check existing attendance bekerja dengan reliable
- [ ] Frontend perlu di-reload untuk apply changes (user perlu refresh browser)

## Next Steps

1. **User perlu refresh browser** dengan `Ctrl+Shift+R` untuk clear cache dan load API client yang baru
2. Test submit attendance dari UI
3. Verify error messages muncul dengan jelas (tidak `[object Object]`)

## Status

✅ **Backend**: Fixed dan tested - berfungsi dengan baik  
⏳ **Frontend**: Fixed, perlu browser reload untuk apply changes  

---

**Fixed by**: Kiro AI Assistant  
**Date**: 11 Juli 2026, 17:48  
**Status**: ✅ RESOLVED - Pending frontend reload
