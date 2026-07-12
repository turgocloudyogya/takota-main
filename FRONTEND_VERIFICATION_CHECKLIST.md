# Frontend Integration Checklist

**Status:** ✅ Backend API berfungsi 100% (16/16 tests passed)  
**Date:** 11 Juli 2026, 18:46 WIB

## Backend Status
✅ Backend running on http://localhost:8080  
✅ Frontend running on http://localhost:5173  
✅ All API endpoints working correctly

---

## User Pages Checklist (/main/*)

### 1. Login Page (/)
- [ ] Login form dengan username & password
- [ ] Integrasi API POST /api/auth
- [ ] Handle success (redirect ke /main atau /admin/dashboard)
- [ ] Handle error (tampilkan pesan error)
- [ ] Token disimpan di localStorage

### 2. Main/Dashboard (/main)
- [ ] API call GET /api/user/home
- [ ] Display greeting widget (nama user)
- [ ] Display today's attendance status
- [ ] Display absence history list
- [ ] Floating action button (FAB) attendance
- [ ] Navigation ke attendance, absence, photos

### 3. Attendance Page (/attendance)
- [ ] Request GPS permission
- [ ] Request camera permission
- [ ] Camera preview (video stream)
- [ ] Toggle front/back camera
- [ ] Capture photo
- [ ] API call POST /api/user/attendance dengan FormData:
  - latitude
  - longitude
  - photo (optional)
- [ ] Handle success (redirect ke /main)
- [ ] Handle error (tampilkan pesan)

### 4. Absence Page (/absence)
- [ ] Form dengan option (sick/permission)
- [ ] Form dengan reason (text)
- [ ] File upload (optional, PDF/DOC)
- [ ] API call POST /api/user/absence dengan FormData:
  - option
  - reason
  - file (optional)
- [ ] Handle success (redirect ke /main)
- [ ] Handle error (tampilkan pesan)

### 5. Photos Gallery (/photos)
- [ ] API call GET /api/all/photos
- [ ] Display grid photos
- [ ] Lazy loading / pagination
- [ ] Photo preview modal
- [ ] Handle empty state

### 6. Change Password (/change-password)
- [ ] Form current password
- [ ] Form new password
- [ ] Form repeat password
- [ ] API call POST /api/auth-chpw
- [ ] Handle success
- [ ] Handle error

---

## Admin Pages Checklist (/admin/*)

### 1. Admin Dashboard (/admin/dashboard)
- [ ] Display statistics cards
- [ ] Count users
- [ ] Count today's attendance
- [ ] Count pending absences
- [ ] Navigation sidebar

### 2. Admin Users (/admin/users)
- [ ] API call GET /api/admin/users
- [ ] Display users table
- [ ] Search functionality
- [ ] Create user modal
  - [ ] API call POST /api/admin/user
- [ ] Edit user modal
  - [ ] API call POST /api/admin/user/:id
- [ ] Delete user
  - [ ] API call DELETE /api/admin/user/:id
- [ ] Pagination

### 3. Admin Attendance (/admin/attendance)
- [ ] API call GET /api/admin/attendances
- [ ] Display attendance table
- [ ] Search functionality
- [ ] View photo (signed URL)
- [ ] View location (Google Maps)
- [ ] Delete attendance
  - [ ] API call DELETE /api/admin/attendance
- [ ] Pagination

### 4. Admin Absence (/admin/absence)
- [ ] API call GET /api/admin/absences
- [ ] Display absence requests table
- [ ] Search functionality
- [ ] View document (signed URL)
- [ ] Approve absence
  - [ ] API call PATCH /api/admin/absence (sign=allow)
- [ ] Reject absence
  - [ ] API call PATCH /api/admin/absence (sign=deny)
- [ ] Pagination

### 5. Admin Reports (/admin/reports)
- [ ] Form select month
- [ ] Form select language (id/en)
- [ ] Export CSV button
  - [ ] API call GET /api/admin/export?month=X&lang=Y
  - [ ] Download file
- [ ] Export PDF button (jika tersedia)
  - [ ] API call GET /api/admin/export/pdf
  - [ ] Download file

---

## API Client Configuration

### User API Client (web/src/lib/api.js)
- [ ] Base URL: http://localhost:8080 (atau dari localStorage)
- [ ] Headers: 
  - Authorization: Bearer {token}
  - key-request: web-user
- [ ] Response parsing: data / error handling
- [ ] Token management (getToken, setToken)

### Admin API Client (web/src/admin/lib/api.js)
- [ ] Base URL: http://localhost:8080 (atau dari localStorage)
- [ ] Headers:
  - Authorization: Bearer {token}
  - key-request: web
- [ ] Response parsing: data / error handling
- [ ] Token management (getToken, setToken)
- [ ] Mock mode disabled (isMockMode = false)

---

## Common Issues to Check

### 1. CORS Issues
✅ Backend already has CORS middleware enabled

### 2. Authorization Headers
- [ ] User pages use `key-request: web-user`
- [ ] Admin pages use `key-request: web`
- [ ] Token format: `Bearer {token}`

### 3. Response Format
Backend returns:
```json
{
  "data": {...},
  "message": "..."
}
```
or error:
```json
{
  "error": {...},
  "message": "..."
}
```

### 4. FormData Upload
- [ ] Content-Type NOT set (browser auto-set for multipart)
- [ ] Use `new FormData()` for file uploads
- [ ] Field names match backend:
  - Attendance: `photo`, `latitude`, `longitude`
  - Absence: `file`, `option`, `reason`

### 5. Token Storage
- [ ] Token saved to localStorage
- [ ] Token retrieved on each API call
- [ ] Token cleared on logout
- [ ] Handle 401/403 (redirect to login)

---

## Manual Testing Steps

### User Flow:
1. [ ] Open http://localhost:5173
2. [ ] Login dengan `user001` / `user123`
3. [ ] Should redirect to `/main`
4. [ ] Dashboard shows greeting dengan nama user
5. [ ] Click FAB → Choose "Attendance"
6. [ ] Allow GPS and camera permissions
7. [ ] Take photo and submit
8. [ ] Should see success message and redirect to /main
9. [ ] Dashboard now shows today's attendance
10. [ ] Test absence request
11. [ ] Test photos gallery

### Admin Flow:
1. [ ] Open http://localhost:5173
2. [ ] Login dengan `admin` / `admin123`
3. [ ] Should redirect to `/admin/dashboard`
4. [ ] Dashboard shows statistics
5. [ ] Click "Siswa" in sidebar
6. [ ] Test create user
7. [ ] Test edit user
8. [ ] Test delete user
9. [ ] Click "Presensi" in sidebar
10. [ ] View attendance list
11. [ ] Test delete attendance (if any)
12. [ ] Click "Izin" in sidebar
13. [ ] View absence list
14. [ ] Test approve/reject absence
15. [ ] Click "Rekap" in sidebar
16. [ ] Test export CSV

---

## Notes

- Backend API: 16/16 tests passed ✅
- Frontend files are in: `/mnt/DiskY/takota/takota-full-any/takota/web/src/`
- Reference (older version) in: `/mnt/DiskY/takota/takota-full-any/takota-frontend/`
- Current version in `takota/web` is more complete with API integration

---

## Next Actions

1. Verify each frontend page manually via browser
2. Check browser console for any JavaScript errors
3. Test all API integrations
4. Fix any issues found
5. Document fixes
