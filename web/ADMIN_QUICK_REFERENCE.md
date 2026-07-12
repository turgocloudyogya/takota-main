# Admin Pages - Quick Reference Guide

## ✅ Verification Status: ALL SYSTEMS GO

**All admin pages are correctly connected to the backend API.**  
**Mock mode is disabled by default.**  
**Ready for production use.**

---

## Admin Pages Overview

### 1. **Dashboard** (`AdminDashboard.jsx`)
- **Purpose:** Overview statistics and trends
- **API Calls:**
  - `listUsers()` - Get student count
  - `listAttendance()` - Get attendance data for charts
  - `listAbsence()` - Get absence statistics
- **Features:**
  - Total students count
  - Today's attendance
  - Pending absence requests
  - Not checked-in students
  - 14-day attendance trend (bar chart)
  - Absence distribution (pie chart)
  - Recent activity feed

### 2. **Users/Siswa** (`AdminUsers.jsx`)
- **Purpose:** Manage student accounts
- **API Calls:**
  - `listUsers({ limit, lastId, search })` - List/search users
  - `createUser({ nickname, callname, type, username, password, changeAsLogin })` - Create
  - `updateUser(id, { ... })` - Update
  - `deleteUser(id)` - Delete
- **Features:**
  - Paginated list (15/page)
  - Create new user
  - Edit existing user
  - Delete user (with confirmation)
  - Search by name/username
  - Type badges (User/Admin)

### 3. **Attendance/Presensi** (`AdminAttendance.jsx`)
- **Purpose:** View and manage attendance records
- **API Calls:**
  - `listAttendance({ limit, lastId, search })` - List records
  - `deleteAttendance(id)` - Delete record
- **Features:**
  - Paginated list (15/page)
  - View photo thumbnails
  - Display GPS location
  - Delete records (with confirmation)
  - Search by name/username
  - Date/time formatting

### 4. **Absence/Izin & Sakit** (`AdminAbsence.jsx`)
- **Purpose:** Review and approve/reject absence requests
- **API Calls:**
  - `listAbsence({ limit, lastId, search })` - List requests
  - `signAbsence(id, sign)` - Approve ('allow') or reject ('deny')
- **Features:**
  - Paginated list (15/page)
  - Approve/reject buttons for pending
  - Change existing status
  - View attachments
  - Type badges (Sakit/Izin)
  - Status chips (Pending/Approved/Rejected)

### 5. **Reports/Rekap & Unduh** (`AdminReports.jsx`)
- **Purpose:** Generate and download attendance reports
- **API Calls:**
  - `listUsers({ limit: 100, lastId })` - Fetch all students
  - `exportAttendancePDF({ startDate, endDate, duName, duAddress, studentIds })` - Generate PDF
- **Features:**
  - Download blank CSV template
  - Generate PDF report (2-week periods)
  - Select specific students
  - Filter students
  - Optional DU/DI info
  - Date range picker

---

## API Configuration

### Base URL
- **Default:** `http://localhost:8080`
- **Configurable:** Via admin settings page
- **Storage:** `localStorage.getItem('takota_api_base_url')`

### Mock Mode
- **Default:** `false` (disabled)
- **Toggle:** Via admin settings
- **Storage:** `localStorage.getItem('takota_admin_mock_mode')`

### Authentication
- **Token Type:** JWT Bearer
- **Storage:** `localStorage.getItem('takota_admin_token')`
- **Header:** `Authorization: Bearer <token>`
- **Additional Header:** `Key-Request: web`

---

## Testing the Integration

### 1. Start Backend
```bash
cd src
docker-compose up -d
```

### 2. Run API Tests
```bash
cd web
./test_admin_api.sh
```

### 3. Start Frontend
```bash
cd web
npm run dev
```

### 4. Manual Testing
1. Navigate to `http://localhost:5173`
2. Login: `admin` / `admin123`
3. Test each admin page:
   - ✓ Dashboard loads statistics
   - ✓ Users: list, create, edit, delete
   - ✓ Attendance: list, delete
   - ✓ Absence: list, approve, reject
   - ✓ Reports: export PDF, download template

---

## File Structure

```
web/src/admin/
├── lib/
│   ├── api.js              # ⭐ Main API client (all endpoints)
│   ├── normalize.js        # Data normalization utilities
│   ├── session.js          # JWT token management
│   ├── mockData.js         # Mock data (only used in preview mode)
│   ├── csvTemplate.js      # CSV template download
│   └── dateWindow.js       # Date utilities
├── pages/
│   ├── AdminDashboard.jsx  # Dashboard with statistics
│   ├── AdminUsers.jsx      # User management (CRUD)
│   ├── AdminAttendance.jsx # Attendance list & delete
│   ├── AdminAbsence.jsx    # Absence approval workflow
│   └── AdminReports.jsx    # Export functionality
└── components/
    ├── ListChrome.jsx      # Pagination components
    ├── Modals.jsx          # Confirmation dialogs
    ├── UserFormModal.jsx   # User create/edit form
    ├── StatCard.jsx        # Dashboard stat cards
    ├── StatusChip.jsx      # Status badges
    ├── FormField.jsx       # Form inputs
    └── PageHeader.jsx      # Page headers
```

---

## Common Issues & Solutions

### Issue: "Cannot connect to server"
**Solution:** 
- Check if backend is running: `docker-compose ps`
- Check API base URL in admin settings
- Verify network connectivity

### Issue: "JWT expired, please try login"
**Solution:**
- Token expires after 24 hours
- Login again to get new token
- Token auto-refreshed on each successful request

### Issue: "No data displayed"
**Solution:**
- Check if backend has data: `curl http://localhost:8080/api/admin/users -H "Authorization: Bearer <token>"`
- Verify normalization in `normalize.js` handles your field names
- Check browser console for errors

### Issue: "401 Unauthorized"
**Solution:**
- Verify user has admin role (`type: "admin"`)
- Check token is being sent in request headers
- Token may be expired - login again

---

## API Response Examples

### List Users Response
```json
{
  "users": [
    {
      "id": "uuid-here",
      "username": "user001",
      "nickname": "John Doe",
      "callname": "John",
      "type": "user",
      "created_at": "2026-07-11T10:00:00Z"
    }
  ]
}
```

### List Attendance Response
```json
{
  "attendances": [
    {
      "id": "uuid-here",
      "user_id": "uuid-here",
      "username": "user001",
      "nickname": "John Doe",
      "date": "2026-07-11T14:30:00Z",
      "latitude": -7.7546612,
      "longitude": 110.3658561,
      "location": "Office",
      "photo": "https://..."
    }
  ]
}
```

### List Absence Response
```json
{
  "absences": [
    {
      "id": "uuid-here",
      "user_id": "uuid-here",
      "username": "user001",
      "nickname": "John Doe",
      "date": "2026-07-11",
      "option": "sick",
      "reason": "Flu",
      "sign": "pending",
      "file": "https://..."
    }
  ]
}
```

---

## Environment Variables

**Frontend** (Vite):
- No environment variables required
- API base URL configured in localStorage

**Backend** (Go):
- See `src/.env` for backend configuration
- Default: `http://localhost:8080`
- Port configurable via `PORT` env var

---

## Production Deployment Checklist

### Frontend
- [ ] Build optimized bundle: `npm run build`
- [ ] Set API base URL to production server
- [ ] Configure CORS on backend for frontend domain
- [ ] Serve from CDN or static hosting
- [ ] Enable HTTPS

### Backend
- [ ] Set `APP_ENV=production`
- [ ] Set `GIN_MODE=release`
- [ ] Use strong `JWT_SECRET`
- [ ] Enable database SSL (`DB_SSL_MODE=require`)
- [ ] Configure proper CORS origins
- [ ] Set up reverse proxy (nginx/traefik)
- [ ] Enable HTTPS with valid certificate

---

## Support

For issues or questions:
1. Check this guide
2. Review `/web/ADMIN_API_VERIFICATION.md`
3. Check browser console for errors
4. Review backend logs: `docker-compose logs api`

---

**Last Updated:** 2026-07-11  
**Status:** ✅ Production Ready  
**Version:** 1.0.0
