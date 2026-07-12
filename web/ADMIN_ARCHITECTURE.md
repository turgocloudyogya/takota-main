# Admin Pages Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Admin User)                      │
│                     http://localhost:5173                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ React 18 + Vite
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                       Admin Dashboard SPA                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Admin Pages (UI Layer)                    │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │  Dashboard   │  │    Users     │  │  Attendance  │     │ │
│  │  │ (Statistics) │  │    (CRUD)    │  │  (List/Del)  │     │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │ │
│  │  ┌──────▼───────┐  ┌──────▼───────┐                        │ │
│  │  │   Absence    │  │   Reports    │                        │ │
│  │  │ (Approve/Rej)│  │ (PDF Export) │                        │ │
│  │  └──────┬───────┘  └──────┬───────┘                        │ │
│  └─────────┼──────────────────┼─────────────────────────────────┘ │
│            │                  │                                   │
│  ┌─────────▼──────────────────▼─────────────────────────────────┐ │
│  │                API Client Layer (api.js)                      │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │ │
│  │  │   listUsers │  │listAttendance│ │  listAbsence │         │ │
│  │  │  createUser │  │deleteAttend. │ │ signAbsence  │         │ │
│  │  │  updateUser │  │              │ │              │         │ │
│  │  │  deleteUser │  │              │ │              │         │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘         │ │
│  │  ┌─────────────┐  ┌─────────────┐                           │ │
│  │  │exportPDF    │  │   login      │                           │ │
│  │  └─────────────┘  └─────────────┘                           │ │
│  └───────────────────────────┬───────────────────────────────────┘ │
│                              │                                     │
│  ┌───────────────────────────▼───────────────────────────────────┐ │
│  │              Utility Layer (Normalization)                    │ │
│  │  • normalize.js  - Data transformation                        │ │
│  │  • session.js    - JWT token management                       │ │
│  │  • dateWindow.js - Date utilities                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            │ Authorization: Bearer <JWT>
                            │ Key-Request: web
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                    Backend API (Go + Gin)                            │
│                     http://localhost:8080                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Route Handlers                            │  │
│  │  /api/auth              - Authentication                      │  │
│  │  /api/admin/users       - User management                     │  │
│  │  /api/admin/user        - Create user                         │  │
│  │  /api/admin/user/:id    - Update/delete user                 │  │
│  │  /api/admin/attendances - Attendance list                     │  │
│  │  /api/admin/attendance  - Delete attendance                   │  │
│  │  /api/admin/absences    - Absence list                        │  │
│  │  /api/admin/absence     - Approve/reject absence              │  │
│  │  /api/admin/export/pdf  - PDF export                          │  │
│  │  /api/all/info          - User info                           │  │
│  └────────────┬─────────────────────────────────────────────────┘  │
│               │                                                      │
│  ┌────────────▼─────────────────────────────────────────────────┐  │
│  │                     Middleware Stack                          │  │
│  │  • JWT Validation                                             │  │
│  │  • Role-Based Access Control (admin/user)                     │  │
│  │  • Password Check                                             │  │
│  │  • Error Handling                                             │  │
│  └────────────┬─────────────────────────────────────────────────┘  │
│               │                                                      │
│  ┌────────────▼─────────────────────────────────────────────────┐  │
│  │                   Business Logic Layer                        │  │
│  │  • Controllers  - Request handling                            │  │
│  │  • Services     - Business logic                              │  │
│  │  • Repository   - Data access                                 │  │
│  └────────────┬─────────────────────────────────────────────────┘  │
└────────────────┼──────────────────────────────────────────────────┘
                 │
        ┌────────┴────────┬───────────────┬──────────────┐
        │                 │               │              │
┌───────▼────────┐ ┌─────▼──────┐ ┌─────▼──────┐ ┌────▼──────┐
│  PostgreSQL 16 │ │  Redis 7   │ │ MinIO/S3   │ │   JWT     │
│   (Database)   │ │  (Cache)   │ │ (Storage)  │ │ (Auth)    │
├────────────────┤ ├────────────┤ ├────────────┤ └───────────┘
│ • users        │ │ • auth_ids │ │ • photos   │
│ • attendance   │ │ • sessions │ │ • documents│
│ • absence      │ │ (optional) │ │ • exports  │
└────────────────┘ └────────────┘ └────────────┘
```

---

## Data Flow - User CRUD Example

### Create User Flow

```
┌──────────────┐
│ Admin clicks │
│ "Tambah      │
│  Siswa"      │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│ UserFormModal.jsx                │
│ • Shows form                     │
│ • Validates input                │
│ • Calls api.createUser()         │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ api.js - createUser()            │
│ • Checks isMockMode() → false    │
│ • Builds request body            │
│ • Adds JWT token to header       │
│ • POST /api/admin/user           │
└──────┬───────────────────────────┘
       │
       ▼ HTTP POST
┌──────────────────────────────────┐
│ Backend: POST /api/admin/user    │
│ • JWT middleware validates token │
│ • Role check: must be admin      │
│ • Controller validates input     │
│ • Service creates user           │
│ • Repository inserts to DB       │
│ • Returns user object            │
└──────┬───────────────────────────┘
       │
       ▼ Response
┌──────────────────────────────────┐
│ api.js - receives response       │
│ • Checks response.ok             │
│ • Parses JSON                    │
│ • Returns normalized data        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ AdminUsers.jsx                   │
│ • Shows success toast            │
│ • Closes modal                   │
│ • Calls handleRefresh()          │
│ • Updates list display           │
└──────────────────────────────────┘
```

---

## Mock Mode Configuration Flow

```
┌─────────────────────────────┐
│ Page component loads        │
│ (e.g., AdminUsers.jsx)      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Calls api.listUsers()       │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ api.js - listUsers()                            │
│                                                 │
│  if (isMockMode()) {              ┌──────────┐ │
│    // Returns mock data ──────────▶ DISABLED │ │
│  }                                └──────────┘ │
│                                       (default)│
│  ✓ Makes real HTTP request                     │
│    to backend API                               │
└─────────────────────────────────────────────────┘
```

**Mock Mode Default:**
- `localStorage.getItem('takota_admin_mock_mode')` returns `null`
- `isMockMode()` returns `false` when value is `null`
- **Result:** Real backend API is used by default

---

## Error Handling Flow

```
┌─────────────────┐
│ API call fails  │
│ (e.g., 500)     │
└────────┬────────┘
         │
         ▼
┌────────────────────────────┐
│ api.js - request()         │
│ • Catches error            │
│ • Extracts error message   │
│ • Throws ApiError          │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Page component             │
│ • try-catch block          │
│ • Catches ApiError         │
│ • Shows toast notification │
│ • Logs error (dev mode)    │
└────────────────────────────┘
```

**401/403 Handling:**
```
Backend returns 401/403
         │
         ▼
api.js detects unauthorized
         │
         ▼
clearSession() called
         │
         ▼
Token removed from localStorage
         │
         ▼
User redirected to login
```

---

## Authentication Flow

```
┌──────────────────────┐
│ Admin enters         │
│ username + password  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│ POST /api/auth               │
│ {                            │
│   "username": "admin",       │
│   "password": "admin123"     │
│ }                            │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Backend validates            │
│ • Checks username/password   │
│ • Generates JWT              │
│ • Creates auth_id            │
│ • Returns token              │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Frontend receives token      │
│ • Stores in localStorage     │
│ • Decodes JWT payload        │
│ • Checks user type (admin)   │
│ • Redirects to dashboard     │
└──────────────────────────────┘

Subsequent requests:
┌──────────────────────────────┐
│ Every API call               │
│ • Reads token from storage   │
│ • Adds to Authorization      │
│   header: Bearer <token>     │
│ • Backend validates JWT      │
└──────────────────────────────┘
```

---

## Component Hierarchy

```
AdminLayout.jsx (Root)
│
├─ Navigation (Sidebar)
│  ├─ Dashboard link
│  ├─ Users link
│  ├─ Attendance link
│  ├─ Absence link
│  └─ Reports link
│
└─ Content Area (Routes)
   │
   ├─ AdminDashboard.jsx
   │  ├─ PageHeader
   │  ├─ StatCard (x4)
   │  ├─ Card > BarChart (14-day trend)
   │  ├─ Card > PieChart (absence distribution)
   │  └─ Card > Activity feed
   │
   ├─ AdminUsers.jsx
   │  ├─ PageHeader
   │  ├─ Toolbar (search + refresh + create button)
   │  ├─ Card > Table (user list)
   │  ├─ PagerFooter (pagination)
   │  ├─ UserFormModal (create/edit)
   │  └─ ConfirmDialog (delete)
   │
   ├─ AdminAttendance.jsx
   │  ├─ PageHeader
   │  ├─ Toolbar (search + refresh)
   │  ├─ Card > Table (attendance list)
   │  ├─ PagerFooter (pagination)
   │  └─ ConfirmDialog (delete)
   │
   ├─ AdminAbsence.jsx
   │  ├─ PageHeader
   │  ├─ Toolbar (search + refresh)
   │  ├─ Card > Table (absence list)
   │  ├─ PagerFooter (pagination)
   │  └─ ConfirmDialog (approve/reject)
   │
   └─ AdminReports.jsx
      ├─ PageHeader
      ├─ Card (blank template download)
      └─ Card (PDF export builder)
         ├─ Date range selector
         ├─ DU/DI info inputs
         ├─ Student multi-select list
         └─ Build PDF button
```

---

## API Client Architecture

```
api.js (Main exports)
│
├─ Configuration
│  ├─ getBaseUrl()       → Returns API base URL
│  ├─ setBaseUrl(url)    → Updates base URL
│  ├─ isMockMode()       → Returns false (default)
│  └─ setMockMode(bool)  → Toggle mock mode
│
├─ Authentication
│  ├─ login()            → POST /api/auth
│  ├─ logout()           → Clears session
│  └─ changePassword()   → POST /api/auth-chpw
│
├─ Admin - Users
│  ├─ listUsers()        → GET /api/admin/users
│  ├─ createUser()       → POST /api/admin/user
│  ├─ updateUser()       → POST /api/admin/user/:id
│  └─ deleteUser()       → DELETE /api/admin/user/:id
│
├─ Admin - Attendance
│  ├─ listAttendance()   → GET /api/admin/attendances
│  └─ deleteAttendance() → DELETE /api/admin/attendance
│
├─ Admin - Absence
│  ├─ listAbsence()      → GET /api/admin/absences
│  └─ signAbsence()      → PATCH /api/admin/absence
│
├─ Admin - Export
│  ├─ exportAttendanceServer()  → GET /api/admin/export
│  └─ exportAttendancePDF()     → GET /api/admin/export/pdf
│
└─ Global
   ├─ globalInfo()       → GET /api/all/info
   └─ listPhotos()       → GET /api/all/photos

Core request() helper
│
├─ Builds URL with query params
├─ Adds headers (Content-Type, Authorization, Key-Request)
├─ Handles FormData vs JSON
├─ Sends fetch() request
├─ Handles 401/403 → auto-logout
├─ Parses response (JSON or blob)
└─ Throws ApiError on failure
```

---

## File Organization

```
web/src/admin/
│
├── lib/                    (Business logic & utilities)
│   ├── api.js             ← ⭐ Main API client
│   ├── normalize.js       ← Data transformation
│   ├── session.js         ← JWT management
│   ├── mockData.js        ← Mock data (preview mode only)
│   ├── csvTemplate.js     ← CSV download
│   └── dateWindow.js      ← Date utilities
│
├── pages/                  (Route components)
│   ├── AdminDashboard.jsx ← Dashboard with charts
│   ├── AdminUsers.jsx     ← User CRUD
│   ├── AdminAttendance.jsx← Attendance management
│   ├── AdminAbsence.jsx   ← Absence approval
│   ├── AdminReports.jsx   ← Export functionality
│   └── AdminApiTester.jsx ← API testing tool
│
├── components/             (Reusable UI components)
│   ├── ListChrome.jsx     ← Toolbar + PagerFooter
│   ├── Modals.jsx         ← ConfirmDialog
│   ├── UserFormModal.jsx  ← User form
│   ├── StatCard.jsx       ← Dashboard cards
│   ├── StatusChip.jsx     ← Status badges
│   ├── FormField.jsx      ← Form inputs
│   └── PageHeader.jsx     ← Page headers
│
└── AdminLayout.jsx         (Root layout with navigation)
```

---

## Key Design Decisions

### 1. **Centralized API Client**
- Single source of truth for all backend communication
- Easy to add new endpoints
- Consistent error handling
- Mock mode toggle for development

### 2. **Data Normalization Layer**
- Decouples UI from backend field names
- Handles variations in response structure
- Single file to update if backend changes

### 3. **Cursor-Based Pagination**
- Efficient for large datasets
- Uses `last_id` from last item in current page
- Supports forward/backward navigation
- Maintains stable pagination

### 4. **Component Reusability**
- Toolbar, PagerFooter, ConfirmDialog shared across pages
- UserFormModal handles both create and edit modes
- StatusChip adapts based on status type

### 5. **Error Handling Strategy**
- Try-catch in every async function
- Toast notifications for user feedback
- ApiError class for consistent error structure
- Auto-logout on 401/403

---

**Last Updated:** 2026-07-11  
**Document Version:** 1.0  
**Status:** Production Ready
